-- Period and point-in-time figures (SPEC 3.4, 3.5, 3.7) against a hand-calculated dataset.
--
-- Business A, starting cash ₱1,000.00 dated 2025-09-01, timezone Asia/Manila.
--   2025-08-31  expense 100 cash                       (before the starting date: profit only, D3)
--   2025-09-30  sale 300 (paid 300 cash)
--   2025-09-30  expense 50 gcash
--   2025-10-01  sale 1,000 (paid 400 gcash, 600 unpaid)  customer C
--   2025-10-01  purchase 700 (paid 200 cash, 500 unpaid) supplier S
--   2025-10-01  owner put in 500 bank_transfer
--   2025-10-15  owner took out 120 cash
--   2025-10-20  expense 80 cash, then voided           (excluded everywhere)
--   2025-10-31  sale 99.99 paid by card
--   2025-11-01  sale 10 cash, then voided               (excluded everywhere)
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

create function tests.f(p_from text, p_to text, p_key text) returns text language sql as $$
  select public.get_dashboard('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_from::date, p_to::date) ->> p_key;
$$;
grant execute on function tests.f(text, text, text) to authenticated;

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

update public.businesses set starting_balance_date = '2025-09-01' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.login_as('11111111-1111-4111-8111-111111111111');
insert into public.customers (id, business_id, name)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'C');
insert into public.suppliers (id, business_id, name)
values ('51515151-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'S');

select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'category_id', (select id::text from public.expense_categories where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and name = 'Rent'), 'expense_date', '2025-08-31', 'amount', '100', 'method', 'cash'));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'sale_date', '2025-09-30', 'items', jsonb_build_array(jsonb_build_object('description', 'A', 'quantity', '1', 'unit_price', '300')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'category_id', (select id::text from public.expense_categories where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and name = 'Utilities'), 'expense_date', '2025-09-30', 'amount', '50', 'method', 'gcash'));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'customer_id', 'c1c1c1c1-0000-4000-8000-000000000001', 'sale_date', '2025-10-01',
  'items', jsonb_build_array(jsonb_build_object('description', 'B', 'quantity', '4', 'unit_price', '250')),
  'payment', jsonb_build_object('amount', '400', 'method', 'gcash')));
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'supplier_id', '51515151-0000-4000-8000-000000000001', 'purchase_date', '2025-10-01',
  'items', jsonb_build_array(jsonb_build_object('description', 'Stock', 'quantity', '7', 'unit_cost', '100')),
  'payment', jsonb_build_object('amount', '200', 'method', 'cash')));
select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'entry_date', '2025-10-01', 'direction', 'in', 'type', 'owner_in', 'amount', '500', 'method', 'bank_transfer'));
select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'entry_date', '2025-10-15', 'direction', 'out', 'type', 'owner_out', 'amount', '120', 'method', 'cash'));
select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', 'e0000000-0000-4000-8000-000000000099',
  'category_id', (select id::text from public.expense_categories where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and name = 'Supplies'), 'expense_date', '2025-10-20', 'amount', '80', 'method', 'cash'));
select public.void_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e0000000-0000-4000-8000-000000000099', 'Mistake');
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'sale_date', '2025-10-31', 'items', jsonb_build_array(jsonb_build_object('description', 'C', 'quantity', '1', 'unit_price', '99.99')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'card')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000001',
  'sale_date', '2025-11-01', 'items', jsonb_build_array(jsonb_build_object('description', 'D', 'quantity', '1', 'unit_price', '10')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd0000000-0000-4000-8000-000000000001', 'Mistake');

select plan(25);

-- October (the month boundary on both sides)
select is(tests.f('2025-10-01', '2025-10-31', 'sales'), '1099.99', 'October sales: 1,000 + 99.99 (Sept 30 and voided Nov 1 excluded)');
select is(tests.f('2025-10-01', '2025-10-31', 'purchases'), '700.00', 'October purchases: 700');
select is(tests.f('2025-10-01', '2025-10-31', 'expenses'), '0.00', 'October expenses: the voided one is excluded');
select is(tests.f('2025-10-01', '2025-10-31', 'profit'), '399.99', 'October profit = 1,099.99 − 700 − 0');
select is(tests.f('2025-10-01', '2025-10-31', 'money_in'), '999.99', 'October Money In: 400 GCash + 500 owner + 99.99 card');
select is(tests.f('2025-10-01', '2025-10-31', 'money_out'), '320.00', 'October Money Out: 200 supplier + 120 owner');
select is(tests.f('2025-10-01', '2025-10-31', 'net_cash_flow'), '679.99', 'October net cash flow = 999.99 − 320');

-- Profit versus cash for an unpaid sale: the 600 unpaid counts in Sales and Profit, not in Money In
select ok(
  tests.f('2025-10-01', '2025-10-01', 'sales') = '1000.00' and tests.f('2025-10-01', '2025-10-01', 'money_in') = '900.00',
  'an unpaid amount counts in Sales (1,000) but only what was paid comes in (400 + 500 owner)'
);

-- September
select is(tests.f('2025-09-01', '2025-09-30', 'sales'), '300.00', 'September sales');
select is(tests.f('2025-09-01', '2025-09-30', 'profit'), '250.00', 'September profit = 300 − 50');
select is(tests.f('2025-08-01', '2025-08-31', 'profit'), '-100.00', 'an expense before the starting date still counts in Profit (D3)');
select is(tests.f('2025-09-30', '2025-09-30', 'expenses'), '50.00', 'a single day at the month''s last day');

-- Point-in-time figures
select is(
  tests.f('2025-10-01', '2025-10-31', 'cash_balance'),
  '1929.99',
  'Cash Balance = 1,000 start + (300 + 400 + 500 + 99.99) in − (50 + 200 + 120) out; the Aug 31 expense is before the start (D3)'
);
select is(tests.f('2025-01-01', '2025-01-31', 'cash_balance'), '1929.99', 'Cash Balance does not depend on the period');
select is(tests.f('2025-10-01', '2025-10-31', 'amount_to_collect'), '600.00', 'Amount to Collect: the unpaid 600');
select is(tests.f('2025-10-01', '2025-10-31', 'amount_to_pay'), '500.00', 'Amount to Pay: the unpaid 500');

select public.create_cash_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'entry_date', ((now() at time zone 'Asia/Manila')::date + 30)::text, 'direction', 'in', 'type', 'owner_in', 'amount', '777'));
select is(tests.f('2025-10-01', '2025-10-31', 'cash_balance'), '1929.99', 'money dated after today is not in the Cash Balance yet');

-- Per method (3.7)
select results_eq(
  $$ select method, money_in, money_out, net from public.get_money_by_method(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-01', '2025-10-31') $$,
  $$ values ('cash'::text, '300.00'::text, '320.00'::text, '-20.00'::text),
            ('gcash', '400.00', '50.00', '350.00'),
            ('maya', '0.00', '0.00', '0.00'),
            ('bank_transfer', '500.00', '0.00', '500.00'),
            ('card', '99.99', '0.00', '99.99'),
            ('cheque', '0.00', '0.00', '0.00'),
            ('other', '0.00', '0.00', '0.00') $$,
  'Money In and Out per payment method, every method listed'
);
select is(
  (select sum(money_in::numeric)::numeric(14, 2)::text from public.get_money_by_method(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-01', '2025-10-31')),
  tests.f('2025-09-01', '2025-10-31', 'money_in'),
  'the per-method Money In adds up exactly to total Money In'
);
select is(
  (select sum(money_out::numeric)::numeric(14, 2)::text from public.get_money_by_method(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-01', '2025-10-31')),
  tests.f('2025-09-01', '2025-10-31', 'money_out'),
  'the per-method Money Out adds up exactly to total Money Out'
);

-- "Today" in Manila
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('id', gen_random_uuid(),
  'sale_date', ((now() at time zone 'Asia/Manila')::date)::text,
  'items', jsonb_build_array(jsonb_build_object('description', 'Today', 'quantity', '1', 'unit_price', '42')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select is(tests.f('2025-10-01', '2025-10-31', 'sales_today'), '42.00', 'Sales Today uses today''s date in Manila');
select is(
  tests.f('2025-10-01', '2025-10-31', 'today'),
  ((now() at time zone 'Asia/Manila')::date)::text,
  '"today" is the calendar date in the business timezone, not UTC'
);

-- Isolation and input checks
select tests.login_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ select public.get_dashboard('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31') $$,
  'P0002', 'not_found',
  'B cannot read A''s figures'
);
select is(
  (select count(*) from public.get_money_by_method('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-01', '2025-10-31')
   where money_in <> '0.00' or money_out <> '0.00'),
  0::bigint,
  'B sees no movement of A by method'
);
select tests.login_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.get_dashboard('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-31', '2025-10-01') $$,
  '22023', 'invalid_input',
  'a period that ends before it starts is rejected'
);

select * from finish();
rollback;
