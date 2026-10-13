-- Chart series, the transaction history and people totals (SPEC 7.5), on the same
-- hand-calculated dataset as 08_period_figures:
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

select plan(24);

-- Monthly series (12 months ending October 2025)
select is(
  (select count(*) from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 12, '2025-10-15')),
  12::bigint,
  'twelve months are listed, empty ones included'
);
select results_eq(
  $$ select month, sales, purchases, expenses, profit
     from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 4, '2025-11-30') $$,
  $$ values ('2025-08-01'::date, '0.00'::text, '0.00'::text, '100.00'::text, '-100.00'::text),
            ('2025-09-01', '300.00', '0.00', '50.00', '250.00'),
            ('2025-10-01', '1099.99', '700.00', '0.00', '399.99'),
            ('2025-11-01', '0.00', '0.00', '0.00', '0.00') $$,
  'per month: voided records excluded, zeros for empty months, profit = sales − purchases − expenses'
);
select is(
  (select profit from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, '2025-10-31')),
  tests.f('2025-10-01', '2025-10-31', 'profit'),
  'a month in the series matches the dashboard Profit for that month'
);
select is(
  (select sales from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, '2025-09-01')),
  tests.f('2025-09-01', '2025-09-30', 'sales'),
  'a month in the series matches the dashboard Sales for that month'
);
select is(
  (select count(*) from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 500)),
  60::bigint,
  'the series is capped at 60 months'
);
select is(
  (select max(month) from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  date_trunc('month', (now() at time zone 'Asia/Manila')::date)::date,
  'by default the series ends with this month in the business timezone'
);

-- Daily series
select results_eq(
  $$ select day, sales from public.get_daily_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-30', '2025-10-02') $$,
  $$ values ('2025-09-30'::date, '300.00'::text), ('2025-10-01', '1000.00'), ('2025-10-02', '0.00') $$,
  'sales per day, every day listed'
);
select is(
  (select sum(sales::numeric)::numeric(14, 2)::text
   from public.get_daily_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-11-30')),
  tests.f('2025-10-01', '2025-11-30', 'sales'),
  'the daily series adds up exactly to period Sales (the voided Nov 1 sale is excluded)'
);
select throws_ok(
  $$ select * from public.get_daily_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-31', '2025-10-01') $$,
  '22023', 'invalid_input', 'a daily range that ends before it starts is rejected'
);
select throws_ok(
  $$ select * from public.get_daily_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2024-01-01', '2025-12-31') $$,
  '22023', 'invalid_input', 'a daily range longer than a year is rejected'
);

-- Transaction history
select results_eq(
  $$ select type, count(*) from public.transactions_feed
     where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' group by type order by type $$,
  $$ values ('customer_payment'::text, 4::bigint), ('expense', 3::bigint), ('other_in', 1::bigint),
            ('other_out', 1::bigint), ('purchase', 1::bigint), ('sale', 4::bigint), ('supplier_payment', 1::bigint) $$,
  'every record type is in the history, voided ones included'
);
select is(
  (select count(*) from public.transactions_feed
   where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and voided_at is not null),
  3::bigint,
  'voided records are flagged: the expense, the sale and its payment'
);
select is(
  (select status from public.transactions_feed where id = 'd0000000-0000-4000-8000-000000000001'),
  'voided',
  'a voided sale shows as voided'
);
select is(
  (select sum(money_in)::numeric(14, 2)::text from public.transactions_feed
   where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and voided_at is null
     and date between '2025-09-01' and '2025-10-31'),
  tests.f('2025-09-01', '2025-10-31', 'money_in'),
  'Money In in the history matches the dashboard'
);
select is(
  (select sum(money_out)::numeric(14, 2)::text from public.transactions_feed
   where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and voided_at is null
     and date between '2025-09-01' and '2025-10-31'),
  tests.f('2025-09-01', '2025-10-31', 'money_out'),
  'Money Out in the history matches the dashboard'
);
select ok(
  (select party_name = 'C' and status = 'partial' and description = 'B' and amount = 1000
   from public.transactions_feed where type = 'sale' and date = '2025-10-01'),
  'a sale shows its customer, payment status, first item and total'
);
select ok(
  (select party_name = 'Supplies' and method = 'cash' from public.transactions_feed
   where id = 'e0000000-0000-4000-8000-000000000099'),
  'an expense shows its category and method'
);

-- People totals
select results_eq(
  $$ select total_sales::text, total_paid::text, balance::text, sale_count
     from public.customer_summary where customer_id = 'c1c1c1c1-0000-4000-8000-000000000001' $$,
  $$ values ('1000.00'::text, '400.00'::text, '600.00'::text, 1::bigint) $$,
  'customer totals: sales, paid and balance'
);
select results_eq(
  $$ select total_purchases::text, total_paid::text, balance::text, purchase_count
     from public.supplier_summary where supplier_id = '51515151-0000-4000-8000-000000000001' $$,
  $$ values ('700.00'::text, '200.00'::text, '500.00'::text, 1::bigint) $$,
  'supplier totals: purchases, paid and balance'
);

-- Isolation
select tests.login_as('22222222-2222-4222-8222-222222222222');
select is(
  (select count(*) from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 12, '2025-10-01')),
  0::bigint,
  'B gets no monthly series for A'
);
select is(
  (select count(*) from public.get_daily_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-09-30', '2025-10-31')
   where sales <> '0.00'),
  0::bigint,
  'B sees no daily sales of A'
);
select is(
  (select count(*) from public.transactions_feed where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'B sees none of A''s history'
);
select is(
  (select count(*) from public.customer_summary where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  + (select count(*) from public.supplier_summary where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'B sees none of A''s people totals'
);
select tests.logout();
select throws_ok(
  $$ select count(*) from public.transactions_feed $$,
  '42501', null, 'a signed-out visitor cannot read the history'
);

select * from finish();
rollback;
