-- Cash received and change on payments (Phase 10, D66): the change is computed by the
-- database, the cash handed over is never less than the payment, and it cannot be edited.
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

grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
insert into public.customers (id, business_id, name)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'C');

-- Total 1,320.00 (1 × 120 + 1 × 1,200), paid in full with ₱1,500 cash.
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000000001', 'sale_date', '2026-10-14',
  'items', jsonb_build_array(
    jsonb_build_object('description', 'Cooking oil', 'quantity', '1', 'unit_price', '120'),
    jsonb_build_object('description', 'Rice 25kg', 'quantity', '1', 'unit_price', '1200')),
  'payment', jsonb_build_object('id', 'fa000000-0000-4000-8000-000000000001', 'amount', 'full',
                                'method', 'cash', 'amount_received', '1500')));

select plan(8);

select results_eq(
  $$ select amount::text, amount_received::text, change_amount::text from public.customer_payments
     where id = 'fa000000-0000-4000-8000-000000000001' $$,
  $$ values ('1320.00', '1500.00', '180.00') $$,
  'paid in full with ₱1,500: the database saves the change, ₱180.00');

select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'sale_date', '2026-10-14',
       'items', jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', '1', 'unit_price', '100')),
       'payment', jsonb_build_object('amount', 'full', 'method', 'cash', 'amount_received', '99.99'))) $$,
  '23514', 'received_too_little', 'cash received cannot be less than what is paid');

select is(
  (select count(*)::int from public.sales where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1, '... and nothing is saved');

select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000000002', 'sale_date', '2026-10-14',
  'customer_id', 'c1c1c1c1-0000-4000-8000-000000000001',
  'items', jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', '1', 'unit_price', '500')),
  'payment', jsonb_build_object('amount', '200', 'method', 'gcash')));
select is(
  (select amount_received from public.customer_payments where sale_id = '5a1e0000-0000-4000-8000-000000000002'),
  null, 'cash received is optional (no change shown)');

select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'fa000000-0000-4000-8000-000000000003', 'sale_id', '5a1e0000-0000-4000-8000-000000000002',
  'amount', '300', 'method', 'cash', 'payment_date', '2026-10-15', 'amount_received', '500'));
select is(
  (select change_amount::text from public.customer_payments where id = 'fa000000-0000-4000-8000-000000000003'),
  '200.00', 'collecting a balance can record cash received and change too');

select throws_ok(
  $$ select public.record_customer_payment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'sale_id', '5a1e0000-0000-4000-8000-000000000002',
       'amount', '1', 'method', 'cash', 'payment_date', '2026-10-15', 'amount_received', '0.50')) $$,
  '23514', 'received_too_little', 'the same rule applies when collecting');

select tests.as_admin();
select throws_ok(
  $$ update public.customer_payments set amount_received = 2000
     where id = 'fa000000-0000-4000-8000-000000000001' $$,
  '23514', 'payment_immutable', 'cash received cannot be changed afterwards, even by a direct update');
select throws_ok(
  $$ insert into public.customer_payments (business_id, sale_id, payment_date, amount, method, amount_received)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5a1e0000-0000-4000-8000-000000000002', '2026-10-15', 1, 'cash', 0.5) $$,
  '23514', null, 'the table itself refuses cash received below the amount');

select * from finish();
rollback;
