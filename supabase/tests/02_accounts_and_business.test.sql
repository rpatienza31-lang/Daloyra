-- Accounts and business setup: profiles, create_business, owner edits, suspension and
-- the audit log (SPEC Sections 6.3, 7.1, 7.4).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Test helpers (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(
  p_id uuid, p_email text, p_confirmed boolean default true, p_full_name text default null
) returns uuid language sql as $$
  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
  values (p_id, p_email, 'authenticated', 'authenticated',
          case when p_confirmed then now() end,
          case when p_full_name is null then '{}'::jsonb
               else jsonb_build_object('full_name', p_full_name) end)
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

select plan(38);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner@example.com', true, '  Maria Santos ');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'new@example.com', false);
select tests.create_user('33333333-3333-4333-8333-333333333333', 'noname@example.com');

select results_eq(
  $$ select email, full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('owner@example.com'::text, 'Maria Santos'::text) $$,
  'signing up creates a profile with the trimmed name'
);

update auth.users set email = 'maria@example.com' where id = '11111111-1111-4111-8111-111111111111';
select is(
  (select email from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'maria@example.com',
  'a changed sign-in email is copied to the profile'
);

select tests.login_as('11111111-1111-4111-8111-111111111111');
select is(
  tests.affected($$ update public.profiles set full_name = 'Maria S.' where id = auth.uid() $$),
  1::bigint,
  'a user can edit their own name'
);
select throws_ok(
  $$ update public.profiles set email = 'x@example.com' where id = auth.uid() $$,
  '42501', null,
  'a user cannot edit the profile email directly'
);

-- ---------------------------------------------------------------------------
-- create_business: who may call it
-- ---------------------------------------------------------------------------
select tests.as_admin();
select set_config('role', 'authenticated', true);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'No session') $$,
  '42501', 'not_authenticated',
  'create_business needs a signed-in user'
);

select tests.login_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Unverified') $$,
  '42501', 'email_not_confirmed',
  'create_business needs a verified email'
);

-- ---------------------------------------------------------------------------
-- create_business: input checks
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_starting_cash_balance => '10.005') $$,
  '22023', 'invalid_input',
  'starting cash with more than 2 decimals is rejected, not rounded'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_starting_cash_balance => '-1') $$,
  '22023', 'invalid_input',
  'negative starting cash is rejected'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_starting_cash_balance => '1e3') $$,
  '22023', 'invalid_input',
  'starting cash must be a plain decimal amount'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), '   ') $$,
  '23514', null,
  'a blank business name is rejected'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_timezone => 'Mars/Olympus') $$,
  '22023', 'invalid_timezone',
  'an unknown timezone is rejected'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_currency_code => 'PESO') $$,
  '23514', null,
  'a currency that is not a 3-letter code is rejected'
);
select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Shop', p_business_type => 'casino') $$,
  '23514', null,
  'an unknown business type is rejected'
);
select is_empty(
  $$ select 1 from public.business_members $$,
  'failed attempts leave no membership behind'
);

-- ---------------------------------------------------------------------------
-- create_business: success
-- ---------------------------------------------------------------------------
select is(
  public.create_business(
    p_business_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    p_name => '  Aling Maria Store ',
    p_owner_name => 'Maria Santos',
    p_business_type => 'retail',
    p_address => '',
    p_contact_number => '0917 123 4567',
    p_email => ' Shop@Example.com ',
    p_currency_code => 'php',
    p_starting_cash_balance => '1500.50'
  ),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'create_business returns the id the client chose'
);

select results_eq(
  $$ select name, business_type, address, contact_number, email, currency_code, timezone,
            starting_cash_balance, starting_balance_date, status, created_by
     from public.businesses $$,
  $$ values ('Aling Maria Store'::text, 'retail'::text, null::text, '0917 123 4567'::text,
             'shop@example.com'::text, 'PHP'::text, 'Asia/Manila'::text, 1500.50::numeric(14, 2),
             (now() at time zone 'Asia/Manila')::date, 'active'::text,
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the business is saved with cleaned-up values and today''s date in Manila'
);

select results_eq(
  $$ select user_id, role from public.business_members $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'owner'::text) $$,
  'the creator becomes the owner'
);

select results_eq(
  $$ select kind, next_value from public.business_counters order by kind $$,
  $$ values ('purchase'::text, 1::bigint), ('sale'::text, 1::bigint) $$,
  'sale and purchase reference counters start at 1'
);

select results_eq(
  $$ select p.code, s.status, s.trial_ends_at = now() + interval '14 days'
     from public.subscriptions s join public.plans p on p.id = s.plan_id $$,
  $$ values ('trial'::text, 'trialing'::text, true) $$,
  'the business starts on a 14-day trial'
);

select results_eq(
  $$ select table_name, action, (new_data ->> 'starting_cash_balance')
     from public.audit_logs $$,
  $$ values ('businesses'::text, 'create'::text, '1500.50'::text) $$,
  'creating the business is written to the audit log'
);

select is(
  public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Aling Maria Store'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'a retried request returns the same business'
);
select is((select count(*) from public.businesses), 1::bigint, 'the retry did not create a duplicate');

select throws_ok(
  $$ select public.create_business(gen_random_uuid(), 'Second shop') $$,
  '23505', 'business_already_exists',
  'one business per account'
);

-- The profile name is filled from onboarding only when signup left it empty.
select tests.login_as('33333333-3333-4333-8333-333333333333');
select public.create_business('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Kusina', 'Jose Cruz');
select is(
  (select full_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'Jose Cruz',
  'the owner name fills an empty profile name'
);
select is_empty(
  $$ select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  'other users'' profiles stay invisible'
);

-- ---------------------------------------------------------------------------
-- Owner edits
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');

select is(
  tests.affected($$ update public.businesses set name = 'Maria''s Store', starting_cash_balance = 2000 $$),
  1::bigint,
  'the owner can edit business settings'
);

select results_eq(
  $$ select action, old_data ->> 'name', new_data ->> 'name', actor_id
     from public.audit_logs where action = 'update' $$,
  $$ values ('update'::text, 'Aling Maria Store'::text, 'Maria''s Store'::text,
             '11111111-1111-4111-8111-111111111111'::uuid) $$,
  'the edit is in the audit log with before and after values and who made it'
);

select is(
  tests.affected($$ update public.businesses set name = name $$),
  1::bigint,
  'an update that changes nothing still succeeds'
);
select is(
  (select count(*) from public.audit_logs where action = 'update'),
  1::bigint,
  '...but does not add noise to the audit log'
);

select throws_ok(
  $$ update public.businesses set status = 'active' $$,
  '42501', null,
  'the owner cannot change the business status'
);
select throws_ok(
  $$ update public.businesses set created_by = auth.uid() $$,
  '42501', null,
  'the owner cannot change who created the business'
);
select throws_ok(
  $$ update public.audit_logs set action = 'create' $$,
  '42501', null,
  'the audit log cannot be edited'
);
select throws_ok(
  $$ delete from public.audit_logs $$,
  '42501', null,
  'the audit log cannot be deleted'
);

-- ---------------------------------------------------------------------------
-- Roles: a manager or staff member cannot edit business settings
-- ---------------------------------------------------------------------------
select tests.as_admin();
select tests.create_user('44444444-4444-4444-8444-444444444444', 'staff@example.com');
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'manager');

select tests.login_as('44444444-4444-4444-8444-444444444444');
select is(
  tests.affected($$ update public.businesses set name = 'Manager was here' $$),
  0::bigint,
  'a manager cannot edit business settings'
);
select is_empty(
  $$ select 1 from public.audit_logs $$,
  'a manager cannot read the audit log'
);
select is_empty(
  $$ select 1 from public.subscriptions $$,
  'a manager cannot read the subscription'
);

-- ---------------------------------------------------------------------------
-- Suspended businesses are read-only
-- ---------------------------------------------------------------------------
select tests.as_admin();
update public.businesses set status = 'suspended' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select tests.login_as('11111111-1111-4111-8111-111111111111');
select is(
  tests.affected($$ update public.businesses set name = 'Still trying' $$),
  0::bigint,
  'the owner of a suspended business cannot edit it'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('logos', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png', auth.uid()) $$,
  '42501', null,
  'the owner of a suspended business cannot upload a logo'
);

select * from finish();
rollback;
