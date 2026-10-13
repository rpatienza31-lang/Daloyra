-- Money rules for sales and customer payments (SPEC Sections 3 and 15).
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

-- One item line: description, quantity, unit price.
create function tests.item(p_description text, p_quantity text, p_price text) returns jsonb
language sql as $$
  select jsonb_build_object('description', p_description, 'quantity', p_quantity, 'unit_price', p_price);
$$;

-- A sale payload. Customer C1 unless p_customer is ''.
create function tests.sale(
  p_id uuid,
  p_items jsonb,
  p_payment jsonb default null,
  p_customer text default 'c1c1c1c1-0000-4000-8000-000000000001',
  p_discount text default '0',
  p_date text default '2026-10-01',
  p_due text default null,
  p_reference text default null
) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'customer_id', p_customer, 'sale_date', p_date, 'due_date', p_due,
    'reference_no', p_reference, 'discount_amount', p_discount, 'items', p_items,
    'payment', p_payment));
$$;

create function tests.pay(p_id uuid, p_sale uuid, p_amount text, p_method text default 'cash',
                          p_date text default '2026-10-02') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'sale_id', p_sale, 'amount', p_amount,
                            'method', p_method, 'payment_date', p_date);
$$;

create function tests.overview(p_id uuid)
returns table (total numeric, amount_paid numeric, balance numeric, payment_status text, due_status text)
language sql as $$
  select total, amount_paid, balance, payment_status, due_status
  from public.sales_overview where id = p_id;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Setup: owner A (business A) with customer C1, manager and staff of A, owner B
-- ---------------------------------------------------------------------------
select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('44444444-4444-4444-8444-444444444444', 'manager-a@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'staff-a@example.com');

select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
insert into public.customers (id, business_id, name)
values ('c2c2c2c2-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B''s customer');
select public.create_sale('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tests.sale(
  'bbbb0000-0000-4000-8000-000000000001', jsonb_build_array(tests.item('B item', '1', '500')),
  p_customer => 'c2c2c2c2-0000-4000-8000-000000000002'));

select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
insert into public.customers (id, business_id, name)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Aling Nena');

select tests.as_admin();
insert into public.business_members (business_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'manager'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'staff');

select plan(71);

select tests.login_as('11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- Totals (SPEC 3.2)
-- ---------------------------------------------------------------------------
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000001',
  jsonb_build_array(tests.item('Rice', '1.333', '49.99'), tests.item('Eggs', '12', '8.25'),
                    tests.item('Candy', '0.333', '0.05')),
  p_discount => '6.64'));

select results_eq(
  $$ select line_total from public.sale_items
     where sale_id = 'a0000000-0000-4000-8000-000000000001' order by position $$,
  $$ values (66.64::numeric(14, 2)), (99.00), (0.02) $$,
  'each line is rounded half-up to 2 decimals (1.333 × 49.99 = 66.64; 0.333 × 0.05 = 0.02)'
);
select results_eq(
  $$ select subtotal, discount_amount, total from public.sales
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (165.66::numeric(14, 2), 6.64::numeric(14, 2), 159.02::numeric(14, 2)) $$,
  'subtotal is the sum of rounded lines and total = subtotal − discount'
);
select results_eq(
  $$ select reference_no from public.sales where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('S-0001'::text) $$,
  'the first sale gets reference S-0001'
);

select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Rice', '1', '100')), p_discount => '100.01')) $$,
  '23514', 'discount_too_large',
  'a discount larger than the subtotal is rejected'
);
select lives_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000002', jsonb_build_array(tests.item('Gift', '1', '100')),
       p_discount => '100')) $$,
  'a discount equal to the subtotal is allowed (total 0)'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Rice', '1', '10.005')))) $$,
  '22023', 'invalid_amount',
  'a price with 3 decimals is rejected, not rounded'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Rice', '0', '10')))) $$,
  '22023', 'invalid_quantity',
  'a zero quantity is rejected'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Rice', '1.0001', '10')))) $$,
  '22023', 'invalid_quantity',
  'a quantity with 4 decimals is rejected'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), '[]'::jsonb)) $$,
  '22023', 'items_required',
  'a sale needs at least one item'
);

-- ---------------------------------------------------------------------------
-- Derived payment status (SPEC 3.3)
-- ---------------------------------------------------------------------------
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000010', jsonb_build_array(tests.item('Order', '1', '1000'))));

select results_eq(
  $$ select * from tests.overview('a0000000-0000-4000-8000-000000000010') $$,
  $$ values (1000.00::numeric, 0.00::numeric, 1000.00::numeric, 'unpaid'::text, 'no_due_date'::text) $$,
  'with no payment the sale is Unpaid with the full balance'
);

select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tests.pay('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', '400', 'cash'));
select results_eq(
  $$ select payment_status, balance from tests.overview('a0000000-0000-4000-8000-000000000010') $$,
  $$ values ('partial'::text, 600.00::numeric) $$,
  'a part payment makes it Partially Paid'
);

select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tests.pay('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000010', '600', 'gcash'));
select results_eq(
  $$ select payment_status, balance, amount_paid from tests.overview('a0000000-0000-4000-8000-000000000010') $$,
  $$ values ('paid'::text, 0.00::numeric, 1000.00::numeric) $$,
  'paying the rest makes it Paid'
);
select results_eq(
  $$ select method, amount from public.customer_payments
     where sale_id = 'a0000000-0000-4000-8000-000000000010' order by method $$,
  $$ values ('cash'::text, 400.00::numeric(14, 2)), ('gcash', 600.00) $$,
  'one sale paid partly in cash and partly by GCash keeps each part under its own method'
);
select is(
  (select customer_id from public.customer_payments where id = 'a1000000-0000-4000-8000-000000000001'),
  'c1c1c1c1-0000-4000-8000-000000000001'::uuid,
  'the payment carries the sale''s customer'
);

-- Overpayment
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000010', '0.01')) $$,
  '23514', 'overpayment',
  'no payment is accepted once the sale is fully paid'
);
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000011', jsonb_build_array(tests.item('Order', '1', '250.50'))));
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '250.51')) $$,
  '23514', 'overpayment',
  'a payment one centavo above the balance is rejected'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Order', '1', '100')),
       jsonb_build_object('amount', '100.01', 'method', 'cash'))) $$,
  '23514', 'overpayment',
  'a first payment larger than the sale is rejected'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '0')) $$,
  '22023', 'invalid_amount',
  'a zero payment is rejected'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '10', 'paypal')) $$,
  '23514', null,
  'an unknown payment method is rejected'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '10', 'cash', '2026-09-30')) $$,
  '23514', 'payment_before_sale',
  'a payment dated before its sale is rejected'
);
select is(
  public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tests.pay('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', '400', 'cash')),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'a retried payment returns the same payment instead of paying twice'
);
select is(
  (select count(*) from public.customer_payments where sale_id = 'a0000000-0000-4000-8000-000000000010'),
  2::bigint,
  '...and no duplicate payment was created'
);

-- ---------------------------------------------------------------------------
-- A balance needs a customer (decision D4)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Order', '1', '100')), p_customer => '')) $$,
  '23514', 'customer_required',
  'an unpaid Walk-in sale is rejected'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('Order', '1', '100')),
       jsonb_build_object('amount', '50', 'method', 'cash'), p_customer => '')) $$,
  '23514', 'customer_required',
  'a part-paid Walk-in sale is rejected'
);
select lives_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000020', jsonb_build_array(tests.item('Quick sale', '1', '75')),
       jsonb_build_object('id', 'a2000000-0000-4000-8000-000000000001', 'amount', '75', 'method', 'cash'),
       p_customer => '')) $$,
  'a fully paid Walk-in sale (the quick sale) is accepted'
);
select results_eq(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000021',
       jsonb_build_array(tests.item('Rice', '1.333', '49.99'), tests.item('Eggs', '12', '8.25')),
       jsonb_build_object('amount', 'full', 'method', 'gcash'), p_customer => '', p_discount => '0.64'))::text $$,
  $$ values ('a0000000-0000-4000-8000-000000000021'::text) $$,
  '"Paid in full" can be sent without the app working out the total'
);
select results_eq(
  $$ select amount, payment_status from public.customer_payments cp
     join public.sales_overview so on so.id = cp.sale_id
     where cp.sale_id = 'a0000000-0000-4000-8000-000000000021' $$,
  $$ values (165.00::numeric(14, 2), 'paid'::text) $$,
  '...the database records a payment of exactly the total it computed'
);
select results_eq(
  $$ select payment_date, payment_status from public.customer_payments cp
     join public.sales_overview so on so.id = cp.sale_id
     where cp.id = 'a2000000-0000-4000-8000-000000000001' $$,
  $$ values ('2026-10-01'::date, 'paid'::text) $$,
  'the quick sale''s payment is dated on the sale date and the sale is Paid'
);
select throws_ok(
  $$ select public.void_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'a2000000-0000-4000-8000-000000000001', 'Wrong amount') $$,
  '23514', 'customer_required',
  'cancelling the payment of a Walk-in sale is refused (it would leave a debt with no customer)'
);

-- ---------------------------------------------------------------------------
-- Editing (SPEC 3.6)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000010', jsonb_build_array(tests.item('Order', '1', '999.99')))) $$,
  '23514', 'total_below_paid',
  'an edit cannot reduce the total below what has been paid'
);
select results_eq(
  $$ select total from public.sales where id = 'a0000000-0000-4000-8000-000000000010' $$,
  $$ values (1000.00::numeric(14, 2)) $$,
  '...and the refused edit changed nothing'
);
select lives_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000011',
       jsonb_build_array(tests.item('Order', '2', '150'), tests.item('Delivery', '1', '50')),
       p_discount => '20', p_due => '2026-10-05')) $$,
  'an edit that keeps the total at or above the amount paid is accepted'
);
select results_eq(
  $$ select subtotal, total, (select count(*) from public.sale_items i where i.sale_id = s.id)
     from public.sales s where id = 'a0000000-0000-4000-8000-000000000011' $$,
  $$ values (350.00::numeric(14, 2), 330.00::numeric(14, 2), 2::bigint) $$,
  'the edit replaced the items and recomputed the totals'
);
select throws_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000010', jsonb_build_array(tests.item('Order', '1', '1000')),
       p_date => '2026-10-03')) $$,
  '23514', 'payment_before_sale',
  'a sale cannot be moved to a date after its payments'
);

-- Customer change carries over to the payments
insert into public.customers (id, business_id, name)
values ('c1c1c1c1-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mang Jose');
select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000010', jsonb_build_array(tests.item('Order', '1', '1000')),
  p_customer => 'c1c1c1c1-0000-4000-8000-000000000009'));
select is(
  (select count(*) from public.customer_payments
   where sale_id = 'a0000000-0000-4000-8000-000000000010'
     and customer_id = 'c1c1c1c1-0000-4000-8000-000000000009'),
  2::bigint,
  'changing a sale''s customer moves its payments to that customer'
);

-- ---------------------------------------------------------------------------
-- Due status (SPEC 3.3, decision D14)
-- ---------------------------------------------------------------------------
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000030', jsonb_build_array(tests.item('Old', '1', '10')),
  p_date => '2026-01-01', p_due => '2026-01-15'));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000031', jsonb_build_array(tests.item('Soon', '1', '10')),
  p_date => ((now() at time zone 'Asia/Manila')::date)::text,
  p_due => ((now() at time zone 'Asia/Manila')::date + 7)::text));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000032', jsonb_build_array(tests.item('Later', '1', '10')),
  p_date => ((now() at time zone 'Asia/Manila')::date)::text,
  p_due => ((now() at time zone 'Asia/Manila')::date + 8)::text));
select results_eq(
  $$ select due_status from public.sales_overview
     where id in ('a0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000031',
                  'a0000000-0000-4000-8000-000000000032')
     order by reference_no $$,
  $$ values ('overdue'::text), ('due_soon'), ('not_due') $$,
  'due status: Overdue before today, Due soon up to 7 days ahead, Not yet due after that'
);
select is(
  (select due_status from public.sales_overview where id = 'a0000000-0000-4000-8000-000000000010'),
  null,
  'a paid sale has no due status'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')),
       p_date => '2026-10-10', p_due => '2026-10-09')) $$,
  '23514', null,
  'a due date before the sale date is rejected'
);

-- ---------------------------------------------------------------------------
-- Voiding (SPEC 3.6)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000010', '  ') $$,
  '22023', 'reason_required',
  'voiding needs a reason'
);
select lives_ok(
  $$ select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000010',
                             'Customer returned everything') $$,
  'the owner can void a sale'
);
select is(
  (select count(*) from public.customer_payments
   where sale_id = 'a0000000-0000-4000-8000-000000000010' and voided_at is null),
  0::bigint,
  'voiding a sale voids all its payments in the same transaction'
);
select results_eq(
  $$ select payment_status, balance, amount_paid from tests.overview('a0000000-0000-4000-8000-000000000010') $$,
  $$ values ('voided'::text, 0.00::numeric, 0.00::numeric) $$,
  'a voided sale shows as Voided with nothing paid and nothing to collect'
);
select is(
  (select sum(balance) from public.sales_overview
   where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and voided_at is not null),
  0.00::numeric,
  'voided sales add nothing to Amount to Collect'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000010', '10')) $$,
  '23514', 'sale_voided',
  'a voided sale cannot receive payments'
);
select throws_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000010', jsonb_build_array(tests.item('Order', '1', '1000')))) $$,
  '23514', 'sale_voided',
  'a voided sale cannot be edited'
);
select lives_ok(
  $$ select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000010', 'Again') $$,
  'voiding twice is harmless'
);

-- Voiding one payment
select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tests.pay('a1000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000011', '100', 'maya'));
select public.void_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a1000000-0000-4000-8000-000000000011', 'Recorded twice');
select results_eq(
  $$ select payment_status, balance from tests.overview('a0000000-0000-4000-8000-000000000011') $$,
  $$ values ('unpaid'::text, 330.00::numeric) $$,
  'a voided payment no longer counts towards the sale'
);

select is(
  public.get_amount_to_collect('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  (select sum(balance)::numeric(14, 2)::text from public.sales_overview
   where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Amount to Collect is the sum of balances of non-voided sales'
);
select is(
  public.get_amount_to_collect('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1c1c1c1-0000-4000-8000-000000000001'),
  '519.02',
  'Amount to Collect for one customer (159.02 + 330.00 + 3 × 10.00; the ₱0 and paid sales add nothing)'
);

-- ---------------------------------------------------------------------------
-- Reference numbers (decision D8)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')), p_reference => 'S-0001')) $$,
  '23505', 'reference_taken',
  'a reference number already in use is rejected'
);
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000040', jsonb_build_array(tests.item('X', '1', '10')),
  p_reference => (select 'S-' || lpad((next_value + 1)::text, 4, '0') from public.business_counters
                  where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and kind = 'sale')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000041', jsonb_build_array(tests.item('X', '1', '10'))));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
  'a0000000-0000-4000-8000-000000000042', jsonb_build_array(tests.item('X', '1', '10'))));
select is(
  (select count(distinct reference_no) from public.sales
   where id in ('a0000000-0000-4000-8000-000000000040', 'a0000000-0000-4000-8000-000000000041',
                'a0000000-0000-4000-8000-000000000042')),
  3::bigint,
  'the counter skips a number that was typed in by hand'
);

-- Idempotent create
select is(
  public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
    'a0000000-0000-4000-8000-000000000041', jsonb_build_array(tests.item('X', '1', '10')))),
  'a0000000-0000-4000-8000-000000000041'::uuid,
  'a retried sale returns the same sale'
);
select is(
  (select count(*) from public.sale_items where sale_id = 'a0000000-0000-4000-8000-000000000041'),
  1::bigint,
  '...without duplicating its items'
);

-- ---------------------------------------------------------------------------
-- Audit log (decision D12)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select action, jsonb_array_length(new_data -> 'items') from public.audit_logs
     where record_id = 'a0000000-0000-4000-8000-000000000011' order by created_at $$,
  $$ values ('create'::text, 1), ('update', 2) $$,
  'creating and editing a sale are in the audit log, each with a snapshot of the items'
);
select results_eq(
  $$ select action from public.audit_logs
     where record_id = 'a0000000-0000-4000-8000-000000000010' and action = 'void' $$,
  $$ values ('void'::text) $$,
  'voiding a sale is in the audit log'
);
select is(
  (select count(*) from public.audit_logs where table_name = 'customer_payments' and action = 'void'
     and record_id in (select id from public.customer_payments where sale_id = 'a0000000-0000-4000-8000-000000000010')),
  2::bigint,
  'the payments voided with the sale are in the audit log too'
);

-- ---------------------------------------------------------------------------
-- Currency lock (decision D6)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.update_business_settings('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A', null,
       null, null, null, null, 'USD', '0', '2026-10-01') $$,
  '23514', 'currency_locked',
  'the currency cannot change once sales exist'
);

-- ---------------------------------------------------------------------------
-- Roles (decision D10)
-- ---------------------------------------------------------------------------
select tests.login_as('55555555-5555-4555-8555-555555555555');
select lives_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000050', jsonb_build_array(tests.item('Staff sale', '1', '20')))) $$,
  'staff can record a sale'
);
select results_eq(
  $$ select id from public.sales $$,
  $$ values ('a0000000-0000-4000-8000-000000000050'::uuid) $$,
  'staff see only the sales they recorded'
);
select lives_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000050', '5')) $$,
  'staff can collect on their own sale'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '5')) $$,
  'P0002', 'not_found',
  'staff cannot collect on someone else''s sale'
);
select throws_ok(
  $$ select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000050', 'No') $$,
  '42501', 'not_allowed',
  'staff cannot void a sale'
);
select throws_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       'a0000000-0000-4000-8000-000000000050', jsonb_build_array(tests.item('Staff sale', '1', '25')))) $$,
  '42501', 'not_allowed',
  'staff cannot edit a sale'
);

select tests.login_as('44444444-4444-4444-8444-444444444444');
select ok(
  (select count(*) from public.sales) > 5,
  'a manager sees every sale of the business'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant and direct writes
-- ---------------------------------------------------------------------------
select tests.login_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ insert into public.sales (business_id, sale_date, reference_no)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-10-01', 'HACK') $$,
  '42501', null,
  'sales cannot be inserted directly, only through create_sale'
);
select throws_ok(
  $$ update public.customer_payments set amount = 1 $$,
  '42501', null,
  'payments cannot be changed directly'
);
select throws_ok(
  $$ select public.create_sale('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')), p_customer => '')) $$,
  '42501', 'not_allowed',
  'A cannot record a sale in B'
);
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.sale(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')),
       p_customer => 'c2c2c2c2-0000-4000-8000-000000000002')) $$,
  '22023', 'customer_not_found',
  'A cannot attach a sale to B''s customer'
);
select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'bbbb0000-0000-4000-8000-000000000001', '10')) $$,
  'P0002', 'not_found',
  'A cannot pay B''s sale'
);
select throws_ok(
  $$ select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbb0000-0000-4000-8000-000000000001', 'x') $$,
  'P0002', 'not_found',
  'A cannot void B''s sale'
);

-- ---------------------------------------------------------------------------
-- The commit-time check catches a broken state written outside the functions
-- ---------------------------------------------------------------------------
select tests.as_admin();
update public.sales set discount_amount = 999 where id = 'a0000000-0000-4000-8000-000000000041';
select throws_ok(
  $$ set constraints all immediate $$,
  '23514', 'discount_too_large',
  'the database refuses at commit a discount larger than the subtotal, whoever wrote it'
);

select * from finish();
rollback;
