-- Reports (SPEC Section 10, Phase 6): every report total agrees with the dashboard for the
-- same period, on the same hand-calculated dataset as 08_period_figures:
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

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
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

select tests.as_admin();
create function tests.r(p_report text, p_from text, p_to text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  execute format('select public.%I(%L, %L::date, %L::date)', p_report,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_from, p_to) into v;
  return v;
end;
$$;
grant execute on function tests.r(text, text, text) to authenticated;
select tests.login_as('11111111-1111-4111-8111-111111111111');

select plan(32);

-- 1. Sales
select is(tests.r('report_sales', '2025-10-01', '2025-10-31') -> 'totals' ->> 'total',
  tests.f('2025-10-01', '2025-10-31', 'sales'), 'Sales report total = dashboard Sales (October)');
select is(tests.r('report_sales', '2025-10-01', '2025-10-31') -> 'totals',
  '{"count": 2, "total": "1099.99", "paid": "499.99", "balance": "600.00"}'::jsonb,
  'Sales report: count, total, paid and balance');
select is(jsonb_array_length(tests.r('report_sales', '2025-11-01', '2025-11-30') -> 'rows'), 0,
  'a voided sale is not in the Sales report');
select is(tests.r('report_sales', null, null) -> 'totals' ->> 'total', '1399.99',
  'all dates: every sale that is not voided');
select is(tests.r('report_sales', '2025-10-01', '2025-10-31') -> 'rows' -> 0 ->> 'reference', 'S-0002',
  'rows are in date order');

-- 2. Purchases
select is(tests.r('report_purchases', '2025-10-01', '2025-10-31') -> 'totals',
  '{"count": 1, "total": "700.00", "paid": "200.00", "balance": "500.00"}'::jsonb,
  'Purchases report totals');
select is(tests.r('report_purchases', '2025-10-01', '2025-10-31') -> 'totals' ->> 'total',
  tests.f('2025-10-01', '2025-10-31', 'purchases'), 'Purchases report total = dashboard Purchases');

-- 3. Expenses by category
select is(tests.r('report_expenses', '2025-08-01', '2025-10-31') -> 'totals' ->> 'amount',
  tests.f('2025-08-01', '2025-10-31', 'expenses'), 'Expenses report total = dashboard Expenses');
select results_eq(
  $$ select r ->> 'category', r ->> 'amount', (r ->> 'count')::int
     from jsonb_array_elements(tests.r('report_expenses', '2025-08-01', '2025-10-31') -> 'rows') r $$,
  $$ values ('Rent'::text, '100.00'::text, 1), ('Utilities', '50.00', 1) $$,
  'expenses per category, largest first; the voided Supplies expense is left out'
);
select is(tests.r('report_expenses', '2025-10-01', '2025-10-31') -> 'totals',
  '{"count": 0, "amount": "0.00"}'::jsonb, 'an empty period totals zero');

-- 4. Profit and Loss
select is(tests.r('report_profit_loss', '2025-10-01', '2025-10-31') -> 'totals' ->> 'profit',
  tests.f('2025-10-01', '2025-10-31', 'profit'), 'P&L Profit = dashboard Profit (October)');
select is(tests.r('report_profit_loss', '2025-08-01', '2025-10-31') -> 'totals',
  '{"sales": "1399.99", "purchases": "700.00", "expenses": "150.00", "profit": "549.99"}'::jsonb,
  'P&L across three months: 1,399.99 − 700 − 150 = 549.99');
select is(tests.r('report_profit_loss', '2025-08-01', '2025-10-31') -> 'totals' ->> 'profit',
  tests.f('2025-08-01', '2025-10-31', 'profit'), 'P&L Profit = dashboard Profit (Aug–Oct)');
select is(jsonb_array_length(tests.r('report_profit_loss', '2025-08-01', '2025-10-31') -> 'rows'), 2,
  'P&L lists expenses by category');

-- 5. Cash Flow
select is(tests.r('report_cash_flow', '2025-09-01', '2025-10-31') -> 'totals' ->> 'money_in',
  tests.f('2025-09-01', '2025-10-31', 'money_in'), 'Cash Flow Money In = dashboard Money In');
select is(tests.r('report_cash_flow', '2025-09-01', '2025-10-31') -> 'totals' ->> 'money_out',
  tests.f('2025-09-01', '2025-10-31', 'money_out'), 'Cash Flow Money Out = dashboard Money Out');
select is(tests.r('report_cash_flow', '2025-10-01', '2025-10-31') -> 'totals' ->> 'net',
  tests.f('2025-10-01', '2025-10-31', 'net_cash_flow'), 'Cash Flow net = dashboard net cash flow');
select results_eq(
  $$ select r ->> 'direction', r ->> 'line', r ->> 'amount'
     from jsonb_array_elements(tests.r('report_cash_flow', '2025-09-01', '2025-10-31') -> 'rows') r $$,
  $$ values ('in'::text, 'customer_payment'::text, '799.99'::text), ('in', 'other_owner_in', '500.00'),
            ('out', 'supplier_payment', '200.00'), ('out', 'other_owner_out', '120.00'),
            ('out', 'expense', '50.00') $$,
  'Money In and Out by kind'
);
select ok(
  (select t ->> 'opening' = '1250.00' and t ->> 'opening_date' = '2025-10-01'
          and t ->> 'closing' = '1929.99' and t ->> 'closing_date' = '2025-10-31'
   from (select tests.r('report_cash_flow', '2025-10-01', '2025-10-31') -> 'totals' as t) x),
  'October: cash at start 1,250 (1,000 + 300 − 50) + net 679.99 = cash at end 1,929.99'
);
select is(tests.r('report_cash_flow', '2025-10-01', '2025-10-31') -> 'totals' ->> 'closing',
  tests.f('2025-10-01', '2025-10-31', 'cash_balance'), 'cash at the end of a past period = Cash Balance when nothing came after');
select is(tests.r('report_cash_flow', '2025-08-01', '2025-09-30') -> 'totals' ->> 'opening', '1000.00',
  'a period starting before the starting date opens with the starting cash (D3)');

-- 6. Payment methods
select is(tests.r('report_payment_methods', '2025-09-01', '2025-10-31') -> 'totals',
  jsonb_build_object('money_in', tests.f('2025-09-01', '2025-10-31', 'money_in'),
                     'money_out', tests.f('2025-09-01', '2025-10-31', 'money_out'),
                     'net', tests.f('2025-09-01', '2025-10-31', 'net_cash_flow')),
  'Payment Method totals = dashboard Money In, Money Out and net');
select is(jsonb_array_length(tests.r('report_payment_methods', '2025-09-01', '2025-10-31') -> 'rows'), 7,
  'every payment method is listed');

-- 7–8. To Collect / To Pay
select is(tests.r('report_to_collect', null, null) -> 'totals' ->> 'balance',
  tests.f('2025-10-01', '2025-10-31', 'amount_to_collect'), 'To Collect (all dates) = Amount to Collect');
select is(tests.r('report_to_pay', null, null) -> 'totals' ->> 'balance',
  tests.f('2025-10-01', '2025-10-31', 'amount_to_pay'), 'To Pay (all dates) = Amount to Pay');
select is(jsonb_array_length(tests.r('report_to_collect', '2025-09-01', '2025-09-30') -> 'rows'), 0,
  'To Collect filters by sale date; paid sales never appear');

-- 9–10. By customer / supplier
select results_eq(
  $$ select r ->> 'party', r ->> 'total', r ->> 'paid', r ->> 'balance', (r ->> 'count')::int
     from jsonb_array_elements(tests.r('report_sales_by_customer', '2025-10-01', '2025-10-31') -> 'rows') r $$,
  $$ values ('C'::text, '1000.00'::text, '400.00'::text, '600.00'::text, 1), (null, '99.99', '99.99', '0.00', 1) $$,
  'sales per customer, walk-in sales together'
);
select is(tests.r('report_sales_by_customer', '2025-10-01', '2025-10-31') -> 'totals',
  tests.r('report_sales', '2025-10-01', '2025-10-31') -> 'totals', 'Sales by Customer totals = Sales report totals');
select is(tests.r('report_purchases_by_supplier', '2025-10-01', '2025-10-31') -> 'totals' ->> 'total',
  tests.f('2025-10-01', '2025-10-31', 'purchases'), 'Purchases by Supplier total = dashboard Purchases');

-- Input and isolation
select throws_ok($$ select tests.r('report_sales', '2025-10-31', '2025-10-01') $$,
  '22023', 'invalid_input', 'a period that ends before it starts is rejected');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select tests.r('report_profit_loss', '2025-10-01', '2025-10-31') $$,
  'P0002', 'not_found', 'B cannot read A''s reports');
select tests.logout();
select throws_ok($$ select public.report_sales('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, null) $$,
  '42501', null, 'a signed-out visitor cannot run reports');

select * from finish();
rollback;
