-- Tenant isolation (SPEC Section 15). Business A and Business B belong to different
-- users. User A must not be able to read, insert, update or delete anything of B's,
-- and a signed-out visitor must be able to read nothing.
--
-- The generic checks walk every public table that has a business_id column, so tables
-- added in later phases are covered automatically; later phases add table-specific cases.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Test helpers (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(p_id uuid, p_email text, p_confirmed boolean default true)
returns uuid language sql as $$
  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
  values (p_id, p_email, 'authenticated', 'authenticated',
          case when p_confirmed then now() end, '{}'::jsonb)
  returning id;
$$;

create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Rows of the target business visible to the caller, per table.
create function tests.visible_rows_of(p_business_id uuid)
returns table (table_name text, row_count bigint) language plpgsql as $$
declare t record;
begin
  for t in
    select c.relname::text as name, a.attname::text as col
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and not a.attisdropped
    where n.nspname = 'public' and c.relkind in ('r', 'v')
      and (a.attname = 'business_id' or (c.relname = 'businesses' and a.attname = 'id'))
  loop
    table_name := t.name;
    begin
      execute format('select count(*) from public.%I where %I = $1', t.name, t.col)
        into row_count using p_business_id;
    exception when insufficient_privilege then
      row_count := 0;
    end;
    return next;
  end loop;
end;
$$;

-- Rows of the target business the caller managed to update, per table.
create function tests.updated_rows_of(p_business_id uuid)
returns table (table_name text, row_count bigint) language plpgsql as $$
declare t record;
begin
  for t in
    select c.relname::text as name, a.attname::text as col
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and (a.attname = 'business_id' or (c.relname = 'businesses' and a.attname = 'id'))
  loop
    table_name := t.name;
    begin
      execute format('update public.%I set updated_at = updated_at where %I = $1', t.name, t.col)
        using p_business_id;
      get diagnostics row_count = row_count;
    exception when insufficient_privilege or undefined_column then
      row_count := 0;
    end;
    return next;
  end loop;
end;
$$;

-- Number of rows a statement changed, run as the current role.
create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setup: two users, two businesses, a logo in each
-- ---------------------------------------------------------------------------
select tests.create_user('11111111-1111-4111-8111-111111111111', 'a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'b@example.com');
select tests.create_user('33333333-3333-4333-8333-333333333333', 'c@example.com');

select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A', 'Ana');
insert into storage.objects (bucket_id, name, owner)
values ('logos', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png', '11111111-1111-4111-8111-111111111111');

select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B', 'Ben');
insert into storage.objects (bucket_id, name, owner)
values ('logos', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png', '22222222-2222-4222-8222-222222222222');

select plan(27);

-- ---------------------------------------------------------------------------
-- User A sees their own business and nothing of B's
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$ select id from public.businesses $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'A sees only their own business'
);

select is_empty(
  $$ select * from tests.visible_rows_of('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') where row_count > 0 $$,
  'A cannot read any row of B in any business-owned table or view'
);

select is(
  (select count(*) from tests.visible_rows_of('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where row_count > 0),
  (select count(*) from tests.visible_rows_of('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  'A can read their own rows in every business-owned table (the check above is not vacuous)'
);

select results_eq(
  $$ select private.my_business_ids() $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'the membership helper returns only A''s business'
);

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'A sees only their own profile'
);

-- ---------------------------------------------------------------------------
-- User A cannot change B's rows
-- ---------------------------------------------------------------------------
select is_empty(
  $$ select * from tests.updated_rows_of('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') where row_count > 0 $$,
  'A cannot update any row of B in any business-owned table'
);

select is(
  tests.affected($$ update public.businesses set name = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$),
  0::bigint,
  'A cannot rename B''s business'
);

select is(
  tests.affected($$ update public.profiles set full_name = 'Hacked' where id = '22222222-2222-4222-8222-222222222222' $$),
  0::bigint,
  'A cannot edit B''s profile'
);

select throws_ok(
  $$ insert into public.business_members (business_id, user_id, role)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'owner') $$,
  '42501', null,
  'A cannot add themselves to B''s business'
);

select throws_ok(
  $$ update public.business_members set role = 'owner'
     where user_id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'A cannot change any membership, including their own'
);

select throws_ok(
  $$ insert into public.businesses (name) values ('Sneaky') $$,
  '42501', null,
  'businesses cannot be inserted directly, only through create_business'
);

select throws_ok(
  $$ insert into public.audit_logs (business_id, table_name, record_id, action)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'businesses',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'update') $$,
  '42501', null,
  'A cannot write into B''s audit log'
);

select throws_ok(
  $$ insert into public.business_counters (business_id, kind)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale') $$,
  '42501', null,
  'A cannot insert counters for B'
);

select throws_ok(
  $$ insert into public.subscriptions (business_id, plan_id, status)
     select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, 'active' from public.plans $$,
  '42501', null,
  'A cannot write subscriptions'
);

select throws_ok(
  $$ delete from public.businesses where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null,
  'A cannot delete B''s business'
);

select throws_ok(
  $$ select * from public.platform_admins $$,
  '42501', null,
  'platform_admins is not readable by signed-in users'
);

-- A user with no business cannot claim B's id through create_business.
select tests.login_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
  $$ select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Takeover') $$,
  '22023', 'invalid_input',
  'create_business cannot take over an existing business id'
);
select is_empty(
  $$ select 1 from public.business_members where business_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'the failed takeover granted no access'
);

-- ---------------------------------------------------------------------------
-- Storage: A cannot read, add, replace or remove B's logo
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$ select name from storage.objects where bucket_id = 'logos' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png'::text) $$,
  'A sees only their own logo'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('logos', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/evil.png', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'A cannot upload into B''s logo folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('logos', 'evil.png', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null,
  'A cannot upload outside a business folder'
);

select is(
  tests.affected($$ update storage.objects set name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stolen.png' where name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png' $$),
  0::bigint,
  'A cannot move B''s logo'
);

select is(
  tests.affected($$ delete from storage.objects where name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png' $$),
  0::bigint,
  'A cannot delete B''s logo'
);

-- ---------------------------------------------------------------------------
-- Signed-out visitors read nothing
-- ---------------------------------------------------------------------------
select tests.logout();

select throws_ok(
  $$ select * from public.businesses $$,
  '42501', null,
  'anon cannot read businesses'
);

select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Anon shop') $$,
  '42501', null,
  'anon cannot call create_business'
);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'logos' $$,
  'anon cannot read any logo'
);

-- Check the data really is there, so the checks above are meaningful.
select set_config('role', 'postgres', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'logos'),
  2::bigint,
  'both logos exist'
);

select * from finish();
rollback;
