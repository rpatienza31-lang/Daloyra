-- Plans, trial expiry and the platform admin area (Phase 8).
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

create function tests.can_record(p_sale_id uuid) returns boolean language plpgsql as $$
begin
  perform public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', p_sale_id,
    'sale_date', '2026-10-01', 'items', jsonb_build_array(jsonb_build_object('description', 'X', 'quantity', '1', 'unit_price', '10')),
    'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
  return true;
exception when insufficient_privilege then
  return false;
end;
$$;
grant execute on function tests.can_record(uuid) to authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('99999999-9999-4999-8999-999999999999', 'admin@example.com');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'sale_date', '2026-10-01', 'items', jsonb_build_array(jsonb_build_object('description', 'X', 'quantity', '1', 'unit_price', '123.45')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select tests.as_admin();
insert into public.platform_admins (user_id) values ('99999999-9999-4999-8999-999999999999');

select plan(26);

-- A new business is on a 14-day trial
select tests.login_as('11111111-1111-4111-8111-111111111111');
select is(public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'access', 'trial', 'a new business is on its free trial');
select ok((public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'days_left')::int between 13 and 14, 'with 14 days left');
select is(public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'price', '599.00', 'the lifetime price is ₱599.00');
select is(public.get_my_access('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null, 'nobody reads another business''s access');
select ok(tests.can_record(gen_random_uuid()), 'during the trial the owner can record');
select is(public.is_platform_admin(), false, 'an owner is not a platform admin');

-- Non-admins cannot use the admin functions
select throws_ok($$ select * from public.admin_list_businesses() $$, '42501', 'not_allowed', 'an owner cannot list businesses');
select throws_ok($$ select public.admin_activate_plan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lifetime', null) $$,
  '42501', 'not_allowed', 'an owner cannot activate their own plan');
select throws_ok($$ select public.admin_extend_trial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 30, null) $$,
  '42501', 'not_allowed', 'an owner cannot extend their own trial');
select throws_ok($$ select * from public.platform_admin_actions $$, '42501', null, 'nobody reads the admin log directly');

-- The trial ends
select tests.as_admin();
update public.subscriptions set trial_ends_at = now() - interval '1 minute'
where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.login_as('11111111-1111-4111-8111-111111111111');
select is(public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'access', 'trial_ended', 'the trial has ended');
select ok(not tests.can_record(gen_random_uuid()), 'after the trial nothing new can be recorded (enforced in the database)');
select throws_ok($$ insert into public.customers (business_id, name)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Late') $$, '42501', null, 'nor can customers be added');
select is((select count(*) from public.sales where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2::bigint,
  'existing records are kept safe');

-- The admin
select tests.login_as('99999999-9999-4999-8999-999999999999');
select is(public.is_platform_admin(), true, 'the platform admin is recognised');
select results_eq(
  $$ select name, owner_email, access, sales, members from public.admin_list_businesses() order by name $$,
  $$ values ('Shop A'::text, 'owner-a@example.com'::text, 'trial_ended'::text, 2::bigint, 1::bigint),
            ('Shop B', 'owner-b@example.com', 'trial', 0::bigint, 1::bigint) $$,
  'the admin sees every business with its owner, access and counts'
);
select is(
  (select count(*) from information_schema.routines r
   join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_name = 'admin_list_businesses' and p.parameter_mode = 'OUT'
     and p.parameter_name in ('total', 'amount', 'balance', 'paid')),
  0::bigint, 'the admin list has no amounts'
);
select is(tests.affected($$ select * from public.sales $$), 0::bigint, 'the admin cannot read business records');

select public.admin_extend_trial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7, 'Asked for more time');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select ok((public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'days_left')::int = 7, 'extending gives 7 more days from today');
select ok(tests.can_record(gen_random_uuid()), 'and the owner can record again');

select tests.login_as('99999999-9999-4999-8999-999999999999');
select public.admin_activate_plan('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lifetime', 'GCash ref 123');
select throws_ok($$ select public.admin_extend_trial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7, null) $$,
  '22023', 'not_on_trial', 'a paid business has no trial to extend');
select tests.as_admin();
update public.subscriptions set trial_ends_at = now() - interval '30 days'
where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.login_as('11111111-1111-4111-8111-111111111111');
select ok(public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'access' = 'paid'
          and tests.can_record(gen_random_uuid()), 'a lifetime plan never expires');

select tests.login_as('99999999-9999-4999-8999-999999999999');
select throws_ok($$ select public.admin_set_business_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'suspended', ' ') $$,
  '22023', 'reason_required', 'suspending needs a reason');
select public.admin_set_business_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'suspended', 'Chargeback');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select ok(public.get_my_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') ->> 'access' = 'suspended'
          and not tests.can_record(gen_random_uuid()), 'a suspended business cannot record');

select tests.login_as('99999999-9999-4999-8999-999999999999');
select public.admin_set_business_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'active', null);
select results_eq(
  $$ select action, business_name, admin_email from public.admin_list_actions() $$,
  $$ values ('reactivate'::text, 'Shop A'::text, 'admin@example.com'::text),
            ('suspend', 'Shop A', 'admin@example.com'),
            ('activate_plan', 'Shop A', 'admin@example.com'),
            ('extend_trial', 'Shop A', 'admin@example.com') $$,
  'every admin action is logged, newest first, with who did it'
);

select tests.logout();
select throws_ok($$ select * from public.admin_list_businesses() $$, '42501', null, 'signed-out visitors cannot reach admin functions');

select * from finish();
rollback;
