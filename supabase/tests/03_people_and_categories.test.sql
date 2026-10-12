-- Customers, suppliers and expense categories: roles, defaults and cross-tenant writes
-- (SPEC Sections 7.2 and 8). Generic read/update isolation is in 01_tenant_isolation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Test helpers (rolled back with the transaction)
-- ---------------------------------------------------------------------------
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

-- Owner A, manager M and staff S of business A; owner B of business B.
select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('44444444-4444-4444-8444-444444444444', 'manager-a@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'staff-a@example.com');

select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
insert into public.customers (id, business_id, name)
values ('c0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B''s customer');

select tests.as_admin();
insert into public.business_members (business_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'manager'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'staff');

select plan(28);

-- ---------------------------------------------------------------------------
-- Default expense categories
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select results_eq(
  $$ select name from public.expense_categories where is_default order by name $$,
  $$ values ('Internet'::text), ('Maintenance'), ('Marketing'), ('Miscellaneous'), ('Rent'),
            ('Salaries/Wages'), ('Supplies'), ('Transportation'), ('Utilities') $$,
  'a new business gets the nine default expense categories'
);

select throws_ok(
  $$ insert into public.expense_categories (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rent') $$,
  '23505', null,
  'category names are unique per business, ignoring capitals'
);

select lives_ok(
  $$ insert into public.expense_categories (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Packaging') $$,
  'the owner can add a category'
);

select throws_ok(
  $$ insert into public.expense_categories (business_id, name, is_default)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sneaky default', true) $$,
  '42501', null,
  'is_default cannot be set from the app'
);

select is(
  tests.affected($$ update public.expense_categories set archived_at = now() where name = 'Rent' $$),
  1::bigint,
  'the owner can archive a category'
);

select throws_ok(
  $$ delete from public.expense_categories where name = 'Packaging' $$,
  '42501', null,
  'categories cannot be deleted'
);

-- ---------------------------------------------------------------------------
-- Customers and suppliers: who may add and edit
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.customers (business_id, name, created_by)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Spoofed',
             '22222222-2222-4222-8222-222222222222') $$,
  '42501', null,
  'the app cannot say who created a record'
);
select lives_ok(
  $$ insert into public.customers (id, business_id, name, phone)
     values ('c0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
             'Aling Nena', '0917 000 0000') $$,
  'the owner can add a customer with an id chosen by the app'
);
select is(
  (select created_by from public.customers where id = 'c0000000-0000-4000-8000-00000000000a'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'created_by is stamped with the signed-in user'
);
select throws_ok(
  $$ insert into public.customers (id, business_id, name)
     values ('c0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Again') $$,
  '23505', null,
  'a retried add with the same id cannot create a duplicate'
);
select is(
  tests.affected($$ update public.customers set name = 'Aling Nena''s Store', archived_at = now()
                    where id = 'c0000000-0000-4000-8000-00000000000a' $$),
  1::bigint,
  'the owner can edit and archive a customer'
);
select throws_ok(
  $$ delete from public.customers where id = 'c0000000-0000-4000-8000-00000000000a' $$,
  '42501', null,
  'customers cannot be deleted'
);
select lives_ok(
  $$ insert into public.suppliers (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mang Jose Wholesale') $$,
  'the owner can add a supplier'
);

-- Manager
select tests.login_as('44444444-4444-4444-8444-444444444444');
select is(
  tests.affected($$ update public.customers set phone = '0918 111 1111'
                    where id = 'c0000000-0000-4000-8000-00000000000a' $$),
  1::bigint,
  'a manager can edit customers'
);
select lives_ok(
  $$ insert into public.expense_categories (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Delivery') $$,
  'a manager can add categories'
);

-- Staff
select tests.login_as('55555555-5555-4555-8555-555555555555');
select lives_ok(
  $$ insert into public.customers (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Walk-in regular') $$,
  'staff can add a customer'
);
select lives_ok(
  $$ insert into public.suppliers (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Palengke stall') $$,
  'staff can add a supplier'
);
select is(
  (select count(*) from public.customers),
  2::bigint,
  'staff can view the business''s customers'
);
select is(
  tests.affected($$ update public.customers set name = 'Changed by staff' $$),
  0::bigint,
  'staff cannot edit customers'
);
select is(
  tests.affected($$ update public.suppliers set archived_at = now() $$),
  0::bigint,
  'staff cannot archive suppliers'
);
select throws_ok(
  $$ insert into public.expense_categories (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Staff category') $$,
  '42501', null,
  'staff cannot add categories'
);
select is(
  tests.affected($$ update public.expense_categories set name = 'Renamed' where name = 'Utilities' $$),
  0::bigint,
  'staff cannot rename categories'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant writes
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$ insert into public.customers (business_id, name)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Planted in B') $$,
  '42501', null,
  'A cannot add a customer to B'
);
select throws_ok(
  $$ insert into public.expense_categories (business_id, name)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Planted in B') $$,
  '42501', null,
  'A cannot add a category to B'
);
select is(
  tests.affected($$ update public.customers set name = 'Hijacked'
                    where id = 'c0000000-0000-4000-8000-00000000000b' $$),
  0::bigint,
  'A cannot edit B''s customer'
);
select throws_ok(
  $$ update public.customers set business_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     where id = 'c0000000-0000-4000-8000-00000000000a' $$,
  '42501', null,
  'a customer cannot be moved to another business'
);

-- ---------------------------------------------------------------------------
-- Suspended businesses are read-only
-- ---------------------------------------------------------------------------
select tests.as_admin();
update public.businesses set status = 'suspended' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.login_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$ insert into public.customers (business_id, name)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'While suspended') $$,
  '42501', null,
  'a suspended business cannot add customers'
);
select is(
  tests.affected($$ update public.expense_categories set name = 'Renamed' where name = 'Utilities' $$),
  0::bigint,
  'a suspended business cannot edit categories'
);

select * from finish();
rollback;
