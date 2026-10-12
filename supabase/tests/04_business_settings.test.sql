-- update_business_settings: owner only, exact amounts, no future starting date.
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

grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('44444444-4444-4444-8444-444444444444', 'manager-a@example.com');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select tests.as_admin();
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'manager');

select plan(8);

select tests.login_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$ select public.update_business_settings('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ' Shop A+ ', 'Ana',
       'food', '', '', ' A@Shop.ph ', 'php', '2500.75', (now() at time zone 'Asia/Manila')::date - 1) $$,
  'the owner can save settings'
);
select results_eq(
  $$ select name, business_type, address, email, currency_code, starting_cash_balance
     from public.businesses where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values ('Shop A+'::text, 'food'::text, null::text, 'a@shop.ph'::text, 'PHP'::text,
             2500.75::numeric(14, 2)) $$,
  'values are cleaned up and the amount is stored exactly'
);
select is(
  (select count(*) from public.audit_logs where table_name = 'businesses' and action = 'update'),
  1::bigint,
  'the change is in the audit log'
);
select throws_ok(
  $$ select public.update_business_settings('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A', null,
       null, null, null, null, 'PHP', '10.005', (now() at time zone 'Asia/Manila')::date) $$,
  '22023', 'invalid_input',
  'an amount with more than 2 decimals is rejected'
);
select throws_ok(
  $$ select public.update_business_settings('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A', null,
       null, null, null, null, 'PHP', '10', (now() at time zone 'Asia/Manila')::date + 1) $$,
  '22023', 'date_in_future',
  'a starting date after today (in Manila) is rejected'
);
select throws_ok(
  $$ select public.update_business_settings('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Hijacked', null,
       null, null, null, null, 'PHP', '0', (now() at time zone 'Asia/Manila')::date) $$,
  null, null,
  'A cannot change B''s settings'
);

select tests.login_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$ select public.update_business_settings('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Manager edit', null,
       null, null, null, null, 'PHP', '0', (now() at time zone 'Asia/Manila')::date) $$,
  '42501', 'not_allowed',
  'a manager cannot change business settings'
);

select tests.as_admin();
select is(
  (select name from public.businesses where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Shop B',
  'B is unchanged'
);

select * from finish();
rollback;
