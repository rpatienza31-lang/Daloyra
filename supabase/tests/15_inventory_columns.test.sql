-- Inventory columns on the products list (D69), on a hand-calculated example.
--   Rice (sells 50, purchase price 30): starting stock 10 (cost 300), bought 20 @ 32 (640)
--   and 10 @ 35 (350), a purchase of 5 voided, sold 3 and 4, 1 damaged.
--   Received 40 · Sold 7 · Adjusted −1 · On hand 32 · Cost received 1,290.00
--   Average cost 1,290 ÷ 40 = 32.25 · Current value 32 × 50 = 1,600.00
--   Oil (sells 100): nothing received, 1 sold → on hand −1, no average, value 0.00.
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

create function tests.line(p_product uuid, p_qty text, p_price text) returns jsonb language sql as $$
  select jsonb_build_object('product_id', p_product, 'description', '', 'quantity', p_qty,
                            'unit_price', p_price, 'unit_cost', p_price);
$$;

grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');

select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-00000000a1ce', 'name', 'Rice', 'unit', 'kg',
  'selling_price', '50', 'purchase_price', '30', 'opening_stock', '10'));
select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-0000000000e1', 'name', 'Oil', 'selling_price', '100'));
select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-0000000000ff', 'name', 'Old item', 'selling_price', '10',
  'purchase_price', '5', 'opening_stock', '3'));
select public.set_product_archived('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0a0a0a0-0000-4000-8000-0000000000ff', true);

select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'purchase_date', '2025-10-01',
  'items', jsonb_build_array(tests.line('a0a0a0a0-0000-4000-8000-00000000a1ce', '20', '32')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'purchase_date', '2025-10-10',
  'items', jsonb_build_array(tests.line('a0a0a0a0-0000-4000-8000-00000000a1ce', '10', '35')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'b1b10000-0000-4000-8000-0000000000aa', 'purchase_date', '2025-10-11',
  'items', jsonb_build_array(tests.line('a0a0a0a0-0000-4000-8000-00000000a1ce', '5', '36')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.void_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b1b10000-0000-4000-8000-0000000000aa', 'Mistake');
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'sale_date', '2025-10-12',
  'items', jsonb_build_array(tests.line('a0a0a0a0-0000-4000-8000-00000000a1ce', '3', '50'),
                             tests.line('a0a0a0a0-0000-4000-8000-0000000000e1', '1', '100')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'sale_date', '2025-10-13',
  'items', jsonb_build_array(tests.line('a0a0a0a0-0000-4000-8000-00000000a1ce', '4', '50')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'product_id', 'a0a0a0a0-0000-4000-8000-00000000a1ce',
  'adjustment_date', '2025-10-15', 'reason', 'damaged', 'quantity', '1'));

select plan(5);

select results_eq(
  $$ select received, sold, adjusted, on_hand, cost_received, average_cost, current_value
     from public.get_product_stock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     where product_id = 'a0a0a0a0-0000-4000-8000-00000000a1ce' $$,
  $$ values ('40', '7', '-1', '32', '1290.00', '32.25', '1600.00') $$,
  'Rice: received 40, sold 7, adjusted −1, 32 on hand, cost 1,290.00, average 32.25, value 1,600.00');

select results_eq(
  $$ select received, sold, on_hand, cost_received, average_cost, current_value
     from public.get_product_stock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
     where product_id = 'a0a0a0a0-0000-4000-8000-0000000000e1' $$,
  $$ values ('0', '1', '-1', '0.00', null::text, '0.00') $$,
  'Oil: sold without stock, no average cost, and no value below zero');

select results_eq(
  $$ select products, cost_received, current_value
     from public.get_inventory_totals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  $$ values (2::bigint, '1290.00', '1600.00') $$,
  'totals of the active products add up the rows');

select results_eq(
  $$ select products, cost_received, current_value
     from public.get_inventory_totals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true) $$,
  $$ values (1::bigint, '15.00', '30.00') $$,
  'archived products are totalled separately');

select throws_ok(
  $$ select * from public.get_inventory_totals('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '42501', null, 'A cannot read the inventory totals of B');

select * from finish();
rollback;
