-- Expenses and Other Money In / Out (SPEC 3.4, 3.7; decision D7).
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

create function tests.expense(p_id uuid, p_category text, p_amount text, p_method text default 'cash',
                              p_date text default '2026-10-05') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'category_id',
    (select id from public.expense_categories where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and name = p_category),
    'expense_date', p_date, 'amount', p_amount, 'method', p_method, 'description', 'Test');
$$;
grant execute on function tests.expense(uuid, text, text, text, text) to authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'staff-a@example.com');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A',
  p_starting_cash_balance => '1000.00');
select tests.as_admin();
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'staff');

select plan(20);
select tests.login_as('11111111-1111-4111-8111-111111111111');

-- Expenses
select lives_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense('e0000000-0000-4000-8000-000000000001', 'Rent', '5000', 'bank_transfer')) $$,
  'the owner can record an expense'
);
select results_eq(
  $$ select amount, method from public.expenses where id = 'e0000000-0000-4000-8000-000000000001' $$,
  $$ values (5000.00::numeric(14, 2), 'bank_transfer'::text) $$,
  'the expense keeps its exact amount and payment method'
);
select is(
  public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tests.expense('e0000000-0000-4000-8000-000000000001', 'Rent', '5000', 'bank_transfer')),
  'e0000000-0000-4000-8000-000000000001'::uuid,
  'a retried expense returns the same expense'
);
select is((select count(*) from public.expenses), 1::bigint, '...without a duplicate');
select throws_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense(gen_random_uuid(), 'Rent', '0')) $$,
  '22023', 'invalid_amount',
  'an expense of 0 is rejected'
);
select throws_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense(gen_random_uuid(), 'Rent', '10', 'paypal')) $$,
  '23514', null,
  'an unknown payment method is rejected'
);
select throws_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'expense_date', '2026-10-05', 'amount', '10',
       'category_id', (select id from public.expense_categories where business_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' limit 1))) $$,
  '22023', 'category_not_found',
  'an expense cannot use another business''s category'
);
update public.expense_categories set archived_at = now() where name = 'Marketing';
select throws_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense(gen_random_uuid(), 'Marketing', '10')) $$,
  '22023', 'category_not_found',
  'a new expense cannot use an archived category'
);
select lives_ok(
  $$ select public.update_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense('e0000000-0000-4000-8000-000000000001', 'Utilities', '4800.50', 'cash')) $$,
  'the owner can edit an expense'
);
select results_eq(
  $$ select action from public.audit_logs where record_id = 'e0000000-0000-4000-8000-000000000001' order by created_at $$,
  $$ values ('create'::text), ('update') $$,
  'expense changes are in the audit log'
);
select lives_ok(
  $$ select public.void_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e0000000-0000-4000-8000-000000000001', 'Duplicate') $$,
  'the owner can void an expense'
);
select throws_ok(
  $$ select public.update_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense('e0000000-0000-4000-8000-000000000001', 'Rent', '1')) $$,
  '23514', 'record_voided',
  'a voided expense cannot be edited'
);

-- Other Money In / Out
select lives_ok(
  $$ select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', 'c0000000-0000-4000-8000-000000000001', 'entry_date', '2026-10-05',
       'direction', 'in', 'type', 'loan_in', 'amount', '20000', 'method', 'bank_transfer')) $$,
  'a loan received can be recorded'
);
select throws_ok(
  $$ select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'entry_date', '2026-10-05',
       'direction', 'in', 'type', 'owner_out', 'amount', '100')) $$,
  '23514', null,
  '"Owner took money out" cannot be Money In'
);
select lives_ok(
  $$ select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'entry_date', '2026-10-05',
       'direction', 'out', 'type', 'other', 'amount', '50')) $$,
  '"Other" can go either way'
);

-- Roles and isolation
select tests.login_as('55555555-5555-4555-8555-555555555555');
select lives_ok(
  $$ select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.expense('e0000000-0000-4000-8000-000000000050', 'Supplies', '30')) $$,
  'staff can record an expense'
);
select results_eq(
  $$ select id from public.expenses $$,
  $$ values ('e0000000-0000-4000-8000-000000000050'::uuid) $$,
  'staff see only their own expenses'
);
select throws_ok(
  $$ select public.void_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e0000000-0000-4000-8000-000000000050', 'No') $$,
  '42501', 'not_allowed',
  'staff cannot void an expense'
);
select tests.login_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ select public.void_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e0000000-0000-4000-8000-000000000050', 'Hack') $$,
  '42501', 'not_allowed',
  'B cannot void A''s expense'
);
select throws_ok(
  $$ insert into public.expenses (business_id, category_id, expense_date, amount)
     select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, '2026-10-05', 1 from public.expense_categories limit 1 $$,
  '42501', null,
  'expenses cannot be inserted directly'
);

select * from finish();
rollback;
