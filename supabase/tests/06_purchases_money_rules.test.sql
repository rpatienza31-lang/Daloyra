-- Money rules for purchases and supplier payments: the mirror of sales (SPEC 3, 15).
-- The sales suite covers each rule in depth; this suite proves the mirror holds.
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

-- One item line: description, quantity, unit price.
create function tests.item(p_description text, p_quantity text, p_price text) returns jsonb
language sql as $$
  select jsonb_build_object('description', p_description, 'quantity', p_quantity, 'unit_cost', p_price);
$$;

-- A purchase payload. Supplier S1 unless p_supplier is ''.
create function tests.purchase(
  p_id uuid,
  p_items jsonb,
  p_payment jsonb default null,
  p_supplier text default '51515151-0000-4000-8000-000000000001',
  p_discount text default '0',
  p_date text default '2026-10-01',
  p_due text default null,
  p_reference text default null
) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'supplier_id', p_supplier, 'purchase_date', p_date, 'due_date', p_due,
    'reference_no', p_reference, 'discount_amount', p_discount, 'items', p_items,
    'payment', p_payment));
$$;

create function tests.pay(p_id uuid, p_purchase uuid, p_amount text, p_method text default 'cash',
                          p_date text default '2026-10-02') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'purchase_id', p_purchase, 'amount', p_amount,
                            'method', p_method, 'payment_date', p_date);
$$;

create function tests.overview(p_id uuid)
returns table (total numeric, amount_paid numeric, balance numeric, payment_status text, due_status text)
language sql as $$
  select total, amount_paid, balance, payment_status, due_status
  from public.purchases_overview where id = p_id;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Setup: owner A with supplier S1, staff of A, owner B with a purchase
select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'staff-a@example.com');

select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
insert into public.suppliers (id, business_id, name)
values ('52525252-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B''s supplier');
select public.create_purchase('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tests.purchase(
  'bbbb0000-0000-4000-8000-000000000001', jsonb_build_array(tests.item('B stock', '1', '500')),
  p_supplier => '52525252-0000-4000-8000-000000000002'));

select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
insert into public.suppliers (id, business_id, name)
values ('51515151-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mang Jose Wholesale');
select tests.as_admin();
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'staff');

select plan(24);
select tests.login_as('11111111-1111-4111-8111-111111111111');

-- Totals and reference numbers
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
  'a0000000-0000-4000-8000-000000000001',
  jsonb_build_array(tests.item('Rice sack', '1.333', '49.99'), tests.item('Eggs tray', '12', '8.25')),
  p_discount => '0.64'));
select results_eq(
  $$ select subtotal, total, reference_no from public.purchases where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (165.64::numeric(14, 2), 165.00::numeric(14, 2), 'P-0001'::text) $$,
  'purchase lines are rounded per line, total = subtotal − discount, numbered P-0001'
);
select throws_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')), p_discount => '10.01')) $$,
  '23514', 'discount_too_large',
  'a purchase discount larger than the subtotal is rejected'
);
select throws_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')), p_supplier => '')) $$,
  '23514', 'supplier_required',
  'an unpaid purchase needs a supplier'
);
select lives_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       'a0000000-0000-4000-8000-000000000002', jsonb_build_array(tests.item('Cash buy', '1', '80')),
       jsonb_build_object('amount', 'full', 'method', 'cash'), p_supplier => '')) $$,
  'a fully paid purchase needs no supplier'
);

-- Status and payments
select results_eq(
  $$ select * from tests.overview('a0000000-0000-4000-8000-000000000001') $$,
  $$ values (165.00::numeric, 0.00::numeric, 165.00::numeric, 'unpaid'::text, 'no_due_date'::text) $$,
  'an unpaid purchase owes its whole total'
);
select public.record_supplier_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tests.pay('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '100', 'cash'));
select results_eq(
  $$ select payment_status, balance from tests.overview('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('partial'::text, 65.00::numeric) $$,
  'a part payment makes the purchase Partially Paid'
);
select throws_ok(
  $$ select public.record_supplier_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', '65.01')) $$,
  '23514', 'overpayment',
  'paying a supplier more than the balance is rejected'
);
select public.record_supplier_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tests.pay('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '65', 'bank_transfer'));
select results_eq(
  $$ select payment_status, balance, amount_paid from tests.overview('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('paid'::text, 0.00::numeric, 165.00::numeric) $$,
  'paying the rest makes it Paid'
);
select is(
  (select supplier_id from public.supplier_payments where id = 'a1000000-0000-4000-8000-000000000001'),
  '51515151-0000-4000-8000-000000000001'::uuid,
  'the payment carries the purchase''s supplier'
);
select throws_ok(
  $$ select public.record_supplier_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', '1', 'cash', '2026-09-30')) $$,
  '23514', null,
  'a supplier payment dated before the purchase is rejected'
);

-- Edit and void
select throws_ok(
  $$ select public.update_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       'a0000000-0000-4000-8000-000000000001', jsonb_build_array(tests.item('Rice sack', '1', '100')))) $$,
  '23514', 'total_below_paid',
  'an edit cannot reduce a purchase below what was paid'
);
select lives_ok(
  $$ select public.void_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'a0000000-0000-4000-8000-000000000001', 'Returned to supplier') $$,
  'the owner can void a purchase'
);
select is(
  (select count(*) from public.supplier_payments
   where purchase_id = 'a0000000-0000-4000-8000-000000000001' and voided_at is null),
  0::bigint,
  'voiding a purchase voids its payments'
);
select results_eq(
  $$ select payment_status, balance from tests.overview('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('voided'::text, 0.00::numeric) $$,
  'a voided purchase owes nothing'
);
select is(
  (select count(*) from public.audit_logs where table_name = 'purchases'
     and record_id = 'a0000000-0000-4000-8000-000000000001'),
  2::bigint,
  'creating and voiding the purchase are in the audit log'
);

-- Amount to Pay
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
  'a0000000-0000-4000-8000-000000000003', jsonb_build_array(tests.item('Flour', '2', '120.25'))));
select is(
  public.get_amount_to_pay('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '240.50',
  'Amount to Pay sums the balances of non-voided purchases'
);

-- Reference numbers: sales and purchases count separately
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a5000000-0000-4000-8000-000000000001', 'sale_date', '2026-10-01',
  'items', jsonb_build_array(jsonb_build_object('description', 'X', 'quantity', '1', 'unit_price', '10')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select results_eq(
  $$ select (select reference_no from public.sales where id = 'a5000000-0000-4000-8000-000000000001'),
            (select reference_no from public.purchases where id = 'a0000000-0000-4000-8000-000000000003') $$,
  $$ values ('S-0001'::text, 'P-0003'::text) $$,
  'sales and purchases have separate number series'
);

-- Roles and isolation
select tests.login_as('55555555-5555-4555-8555-555555555555');
select lives_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       'a0000000-0000-4000-8000-000000000050', jsonb_build_array(tests.item('Staff buy', '1', '20')))) $$,
  'staff can record a purchase'
);
select results_eq(
  $$ select id from public.purchases $$,
  $$ values ('a0000000-0000-4000-8000-000000000050'::uuid) $$,
  'staff see only the purchases they recorded'
);
select throws_ok(
  $$ select public.void_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000050', 'No') $$,
  '42501', 'not_allowed',
  'staff cannot void a purchase'
);

select tests.login_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.purchase(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')),
       p_supplier => '52525252-0000-4000-8000-000000000002')) $$,
  '22023', 'supplier_not_found',
  'A cannot attach a purchase to B''s supplier'
);
select throws_ok(
  $$ select public.record_supplier_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       tests.pay(gen_random_uuid(), 'bbbb0000-0000-4000-8000-000000000001', '10')) $$,
  'P0002', 'not_found',
  'A cannot pay B''s purchase'
);
select throws_ok(
  $$ select public.create_purchase('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tests.purchase(
       gen_random_uuid(), jsonb_build_array(tests.item('X', '1', '10')), p_supplier => '')) $$,
  '42501', 'not_allowed',
  'A cannot record a purchase in B'
);
select throws_ok(
  $$ insert into public.purchases (business_id, purchase_date, reference_no)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-10-01', 'HACK') $$,
  '42501', null,
  'purchases cannot be inserted directly'
);

select * from finish();
rollback;
