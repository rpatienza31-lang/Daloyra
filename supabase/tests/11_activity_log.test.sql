-- Activity log (SPEC 8 and 14): owners see who created, changed or cancelled what, with
-- exact before/after values; nobody else sees it.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(p_id uuid, p_email text) returns uuid language sql as $$
  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
  values (p_id, p_email, 'authenticated', 'authenticated', now(), '{}'::jsonb)
  returning id;
$$;

create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.as_admin() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;
grant execute on function tests.logout() to anon, authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'manager-a@example.com');
update public.profiles set full_name = 'Ana Owner' where id = '11111111-1111-4111-8111-111111111111';
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
select tests.as_admin();
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'manager');

select tests.login_as('11111111-1111-4111-8111-111111111111');
insert into public.customers (id, business_id, name)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Nena');
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-000000000001', 'sale_date', '2026-10-01',
  'items', jsonb_build_array(jsonb_build_object('description', 'Rice', 'quantity', '2', 'unit_price', '49.99')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0000000-0000-4000-8000-000000000001', 'sale_date', '2026-10-01', 'due_date', '2026-10-20',
  'customer_id', 'c1c1c1c1-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('description', 'Rice', 'quantity', '3', 'unit_price', '49.99'))));
select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000001', 'Wrong customer');

create temp view latest as
  select * from public.get_activity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 50, 'sales');
grant select on latest to authenticated;

select plan(14);

select is((select count(*) from latest), 3::bigint, 'a create, an edit and a void of the sale');
select results_eq($$ select action from latest $$, $$ values ('void'::text), ('update'), ('create') $$,
  'newest first');
select is((select label from latest where action = 'create'), 'S-0001', 'the sale is named by its reference');
select is((select amount from latest where action = 'create'), '99.98', 'amounts are exact text');
select is((select actor_name from latest where action = 'create'), 'Ana Owner', 'who did it');
select is((select reason from latest where action = 'void'), 'Wrong customer', 'the void reason');
select is((select changes from latest where action = 'create'), '[]'::jsonb, 'a new record lists no changes');
select ok(
  (select changes @> '[{"field": "total", "old": "99.98", "new": "149.97"}]'::jsonb
      and changes @> '[{"field": "customer_id", "old": null, "new": "Nena"}]'::jsonb
      and changes @> '[{"field": "due_date", "old": null, "new": "2026-10-20"}]'::jsonb
      and changes @> '[{"field": "items", "old": "Rice × 2 @ 49.99", "new": "Rice × 3 @ 49.99"}]'::jsonb
   from latest where action = 'update'),
  'an edit lists each changed field, before and after, with names instead of ids'
);
select ok(
  (select not changes @> '[{"field": "updated_at"}]'::jsonb from latest where action = 'update'),
  'housekeeping fields are left out'
);

-- Paging: five entries saved in the same instant, read two at a time, none skipped.
select tests.as_admin();
insert into public.audit_logs (business_id, table_name, record_id, action, new_data, created_at)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'expenses', gen_random_uuid(), 'create',
       jsonb_build_object('amount', '1.00'), '2020-01-01 00:00:00+00'
from generate_series(1, 5);
select tests.login_as('11111111-1111-4111-8111-111111111111');
create temp table pages (n int, id uuid, created_at timestamptz);
grant all on pages to authenticated;
do $$
declare
  v_before timestamptz;
  v_before_id uuid;
  v_n int := 0;
  r record;
begin
  loop
    v_n := v_n + 1;
    exit when v_n > 10;
    for r in select * from public.get_activity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_before, 2, 'expenses', v_before_id) loop
      insert into pages values (v_n, r.id, r.created_at);
      v_before := r.created_at;
      v_before_id := r.id;
    end loop;
    exit when not found;
  end loop;
end;
$$;
select is((select count(distinct id) from pages), 5::bigint,
  'paging two at a time reaches all five entries saved in the same instant');
select is((select count(*) from pages), 5::bigint, 'and shows none twice');

select tests.login_as('55555555-5555-4555-8555-555555555555');
select is((select count(*) from public.get_activity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')), 0::bigint,
  'a manager does not see the activity log (owner only)');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select is((select count(*) from public.get_activity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')), 0::bigint,
  'another business sees nothing');
select tests.logout();
select throws_ok($$ select * from public.get_activity('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null, 'a signed-out visitor cannot read it');

select * from finish();
rollback;
