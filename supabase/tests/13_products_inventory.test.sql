-- Products, stock and profit per product (Phase 9, decisions D59–D64), on a hand-calculated
-- dataset. Business A (owner + staff), Business B. Timezone Asia/Manila.
--   Rice: sells 50, purchase price 30, opening stock 10.  Oil: sells 100, purchase price 0.
--   2025-09-30  sale    Rice 2 @ 50                     cost 30 each (no purchase yet) = 60
--   2025-10-01  purchase Rice 20 @ 32, Oil 5 @ 70, "Plastic bags" 1 @ 15, discount 5 = 1,000
--   2025-10-05  sale    Rice 3 @ 50, Oil 1 @ 100, "Delivery" 1 @ 20 = 270  cost 96 + 70 = 166
--   2025-10-10  purchase Rice 10 @ 35 = 350
--   2025-10-12  sale    Rice 4 @ 55 = 220                cost 35 each = 140
--   2025-10-13  sale    Rice 100 @ 50, then voided       (excluded everywhere)
--   2025-10-15  Rice 1 damaged                          loss 35
--   2025-10-16  Oil count +2                            (stock only, not a loss)
--   2025-10-17  Rice 5 lost, then voided                 (excluded everywhere)
--   2025-10-20  expense 50
-- October: Sales 490 − Cost of products sold 306 − Other purchases 10 (1,350 − 1,340 of
-- products) − Stock lost 35 − Expenses 50 = Profit 89.
-- Stock now: Rice 10 + 20 + 10 − 2 − 3 − 4 − 1 = 30; Oil 5 − 1 + 2 = 6.
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

create function tests.item(p_product uuid, p_desc text, p_qty text, p_price text) returns jsonb
language sql as $$
  select jsonb_build_object('product_id', p_product, 'description', p_desc, 'quantity', p_qty,
                            'unit_price', p_price, 'unit_cost', p_price);
$$;

grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('11111111-1111-4111-8111-111111111111', 'owner-a@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'owner-b@example.com');
select tests.create_user('55555555-5555-4555-8555-555555555555', 'staff-a@example.com');
select tests.login_as('22222222-2222-4222-8222-222222222222');
select public.create_business('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Shop B');
select public.create_product('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', jsonb_build_object(
  'id', 'b0b0b0b0-0000-4000-8000-000000000001', 'name', 'B secret', 'selling_price', '1', 'purchase_price', '1'));
select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Shop A');
select tests.as_admin();
insert into public.business_members (business_id, user_id, role)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'staff');

select tests.login_as('11111111-1111-4111-8111-111111111111');
select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-00000000a1ce', 'name', 'Rice', 'unit', 'kg',
  'selling_price', '50', 'purchase_price', '30', 'opening_stock', '10'));
select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-0000000000e1', 'name', 'Oil', 'selling_price', '100', 'purchase_price', '0'));

select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000000930', 'sale_date', '2025-09-30',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', '', '2', '50')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'b1b10000-0000-4000-8000-000000001001', 'purchase_date', '2025-10-01', 'discount_amount', '5',
  'items', jsonb_build_array(
    tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '20', '32'),
    tests.item('a0a0a0a0-0000-4000-8000-0000000000e1', 'Oil', '5', '70'),
    tests.item(null, 'Plastic bags', '1', '15')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000001005', 'sale_date', '2025-10-05',
  'items', jsonb_build_array(
    tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '3', '50'),
    tests.item('a0a0a0a0-0000-4000-8000-0000000000e1', 'Oil', '1', '100'),
    tests.item(null, 'Delivery', '1', '20')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'b1b10000-0000-4000-8000-000000001010', 'purchase_date', '2025-10-10',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '10', '35')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000001012', 'sale_date', '2025-10-12',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '4', '55')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000001013', 'sale_date', '2025-10-13',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '100', '50')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5a1e0000-0000-4000-8000-000000001013', 'Mistake');
select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'ad000000-0000-4000-8000-000000001015', 'product_id', 'a0a0a0a0-0000-4000-8000-00000000a1ce',
  'adjustment_date', '2025-10-15', 'reason', 'damaged', 'quantity', '1', 'notes', 'Torn sack'));
select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'ad000000-0000-4000-8000-000000001016', 'product_id', 'a0a0a0a0-0000-4000-8000-0000000000e1',
  'adjustment_date', '2025-10-16', 'reason', 'count', 'direction', 'add', 'quantity', '2'));
select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'ad000000-0000-4000-8000-000000001017', 'product_id', 'a0a0a0a0-0000-4000-8000-00000000a1ce',
  'adjustment_date', '2025-10-17', 'reason', 'lost', 'quantity', '5'));
select public.void_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ad000000-0000-4000-8000-000000001017', 'Found it');
select public.create_expense('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', gen_random_uuid(), 'expense_date', '2025-10-20', 'amount', '50', 'method', 'cash',
  'category_id', (select id from public.expense_categories
                  where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and name = 'Rent')));

select plan(31);

-- ---------------------------------------------------------------------------
-- Cost saved on each sale line (D59)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select s.sale_date, i.description, i.unit_cost::text, i.cost_total::text
     from public.sale_items i join public.sales s on s.id = i.sale_id
     where i.business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and s.voided_at is null
     order by s.sale_date, i.position $$,
  $$ values ('2025-09-30'::date, 'Rice', '30.00', '60.00'),
            ('2025-10-05'::date, 'Rice', '32.00', '96.00'),
            ('2025-10-05'::date, 'Oil', '70.00', '70.00'),
            ('2025-10-05'::date, 'Delivery', null, null),
            ('2025-10-12'::date, 'Rice', '35.00', '140.00') $$,
  'each product line keeps the latest purchase cost on or before its date (else the product price); free text has none'
);

select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'b1b10000-0000-4000-8000-000000000915', 'purchase_date', '2025-09-15',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '1', '29')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select is(
  (select unit_cost::text from public.sale_items where sale_id = '5a1e0000-0000-4000-8000-000000000930'),
  '30.00', 'a purchase recorded later does not change the cost already saved on a sale');
select public.void_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b1b10000-0000-4000-8000-000000000915', 'Test only');

select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000001012', 'sale_date', '2025-10-12',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', '', '4', '55'))));
select results_eq(
  $$ select description, unit_cost::text from public.sale_items
     where sale_id = '5a1e0000-0000-4000-8000-000000001012' $$,
  $$ values ('Rice', '35.00') $$,
  'editing a sale saves the cost again; an empty description takes the product name'
);

-- ---------------------------------------------------------------------------
-- Stock (D60, D62)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select p.name, s.on_hand, s.current_cost
     from public.get_product_stock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') s
     join public.products p on p.id = s.product_id order by p.name $$,
  $$ values ('Oil', '6', '70.00'), ('Rice', '30', '35.00') $$,
  'stock on hand = opening + bought − sold ± adjustments; voided records do not count'
);

select results_eq(
  $$ select reason, quantity::text, cost_total::text from public.stock_adjustments
     where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and voided_at is null
     order by adjustment_date, reason $$,
  $$ values ('damaged', '-1.000', '-35.00'), ('count', '2.000', '140.00'), ('opening', '10.000', '300.00') $$,
  'damaged and lost remove stock, a count adds or removes, opening stock uses the purchase price'
);

select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', '5a1e0000-0000-4000-8000-000000001101', 'sale_date', '2025-11-01',
  'items', jsonb_build_array(tests.item('a0a0a0a0-0000-4000-8000-0000000000e1', 'Oil', '8', '100')),
  'payment', jsonb_build_object('amount', 'full', 'method', 'cash')));
select is(
  (select on_hand from public.get_product_stock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
   where product_id = 'a0a0a0a0-0000-4000-8000-0000000000e1'),
  '-2', 'selling more than the stock is allowed and the stock goes below zero (D60)');
select public.void_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '5a1e0000-0000-4000-8000-000000001101', 'Test only');

select throws_ok(
  $$ select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'product_id', 'a0a0a0a0-0000-4000-8000-00000000a1ce',
       'adjustment_date', '2025-10-18', 'reason', 'count', 'quantity', '1')) $$,
  '22023', 'invalid_input', 'a count needs to say whether it adds or removes stock');

select throws_ok(
  $$ update public.stock_adjustments set notes = 'x' where id = 'ad000000-0000-4000-8000-000000001017' $$,
  '42501', null, 'stock adjustments cannot be changed directly');

-- ---------------------------------------------------------------------------
-- Profit: the new rule everywhere
-- ---------------------------------------------------------------------------
select is(
  (select jsonb_build_object('sales', d ->> 'sales', 'purchases', d ->> 'purchases',
     'cost_of_sales', d ->> 'cost_of_sales', 'other_purchases', d ->> 'other_purchases',
     'stock_losses', d ->> 'stock_losses', 'expenses', d ->> 'expenses', 'profit', d ->> 'profit')
   from public.get_dashboard('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31') d),
  '{"sales": "490.00", "purchases": "1350.00", "cost_of_sales": "306.00", "other_purchases": "10.00",
    "stock_losses": "35.00", "expenses": "50.00", "profit": "89.00"}'::jsonb,
  'dashboard October: 490 − 306 − 10 − 35 − 50 = 89');

select is(
  public.report_profit_loss('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31') -> 'totals',
  '{"sales": "490.00", "cost_of_sales": "306.00", "purchases": "10.00", "stock_losses": "35.00",
    "expenses": "50.00", "profit": "89.00"}'::jsonb,
  'Profit and Loss October agrees with the dashboard');

select results_eq(
  $$ select month, sales, purchases, profit
     from public.get_monthly_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, '2025-10-31') $$,
  $$ values ('2025-09-01'::date, '100.00', '0.00', '40.00'),
            ('2025-10-01'::date, '490.00', '1350.00', '89.00') $$,
  'monthly chart profit follows the same rule (September: 100 − 60 = 40)'
);

select is(
  public.report_profit_by_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31'),
  jsonb_build_object('from', '2025-10-01', 'to', '2025-10-31',
    'rows', '[{"product_id": "a0a0a0a0-0000-4000-8000-00000000a1ce", "product": "Rice", "unit": "kg",
               "quantity": "7", "sales": "370.00", "cost": "236.00", "profit": "134.00"},
              {"product_id": "a0a0a0a0-0000-4000-8000-0000000000e1", "product": "Oil", "unit": "pc",
               "quantity": "1", "sales": "100.00", "cost": "70.00", "profit": "30.00"}]'::jsonb,
    'totals', '{"sales": "470.00", "cost": "306.00", "profit": "164.00", "other_items": "20.00",
                "discounts": "0.00"}'::jsonb),
  'profit per product, best first; free-text sales and discounts are shown as totals');

select is(
  (public.report_profit_by_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31') -> 'totals' ->> 'cost'),
  (public.get_dashboard('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025-10-01', '2025-10-31') ->> 'cost_of_sales'),
  'product costs add up to the dashboard cost of products sold');

select results_eq(
  $$ select kind, date, quantity, voided
     from public.get_product_movements('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0a0a0a0-0000-4000-8000-0000000000e1')
     where date < '2025-11-01' $$,
  $$ values ('adjustment', '2025-10-16'::date, '2', false), ('sale', '2025-10-05'::date, '-1', false),
            ('purchase', '2025-10-01'::date, '5', false) $$,
  'product history lists purchases, sales and adjustments, newest first'
);

-- ---------------------------------------------------------------------------
-- Product rules
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'name', 'rice', 'selling_price', '1')) $$,
  '23505', 'product_name_taken', 'two active products cannot share a name (ignoring capitals)');

select is(
  public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
    'id', 'a0a0a0a0-0000-4000-8000-00000000a1ce', 'name', 'Rice', 'opening_stock', '10')),
  'a0a0a0a0-0000-4000-8000-00000000a1ce'::uuid, 'a retried create returns the same product');
select is(
  (select count(*)::int from public.stock_adjustments where reason = 'opening'
   and product_id = 'a0a0a0a0-0000-4000-8000-00000000a1ce'),
  1, '... and does not add the opening stock twice');

select throws_ok(
  $$ select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'name', 'Sugar', 'selling_price', '1.234')) $$,
  '22023', 'invalid_amount', 'prices are checked like every other amount');

select throws_ok(
  $$ insert into public.products (business_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Direct') $$,
  '42501', null, 'products cannot be inserted directly');

select public.update_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
  'id', 'a0a0a0a0-0000-4000-8000-0000000000e1', 'name', 'Cooking oil', 'unit', 'bottle',
  'selling_price', '105.50', 'purchase_price', '70'));
select results_eq(
  $$ select name, unit, selling_price::text from public.products where id = 'a0a0a0a0-0000-4000-8000-0000000000e1' $$,
  $$ values ('Cooking oil', 'bottle', '105.50') $$, 'owners edit products');

select is(
  (select count(*)::int from public.audit_logs where table_name = 'products'
   and record_id = 'a0a0a0a0-0000-4000-8000-0000000000e1'),
  2, 'creating and editing a product is in the audit log');

select public.set_product_archived('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0a0a0a0-0000-4000-8000-0000000000e1', true);
select lives_ok(
  $$ select public.update_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', '5a1e0000-0000-4000-8000-000000001005', 'sale_date', '2025-10-05',
       'items', jsonb_build_array(
         tests.item('a0a0a0a0-0000-4000-8000-00000000a1ce', 'Rice', '3', '50'),
         tests.item('a0a0a0a0-0000-4000-8000-0000000000e1', 'Oil', '1', '100'),
         tests.item(null, 'Delivery', '1', '20')))) $$,
  'a sale with an archived product can still be edited');

-- ---------------------------------------------------------------------------
-- Roles and tenants
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'sale_date', '2025-10-30',
       'items', jsonb_build_array(tests.item('b0b0b0b0-0000-4000-8000-000000000001', 'x', '1', '1')),
       'payment', jsonb_build_object('amount', 'full', 'method', 'cash'))) $$,
  '22023', 'product_not_found', 'A cannot sell a product of B');

select throws_ok(
  $$ select public.create_purchase('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'purchase_date', '2025-10-30',
       'items', jsonb_build_array(tests.item('b0b0b0b0-0000-4000-8000-000000000001', 'x', '1', '1')),
       'payment', jsonb_build_object('amount', 'full', 'method', 'cash'))) $$,
  '22023', 'product_not_found', 'A cannot buy into a product of B');

select throws_ok(
  $$ select * from public.get_product_stock('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '42501', null, 'A cannot read the stock of B');

select is_empty(
  $$ select * from public.get_product_movements('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b0b0b0b0-0000-4000-8000-000000000001') $$,
  'A sees no history of B''s products');

select tests.login_as('55555555-5555-4555-8555-555555555555');
select is(
  (select count(*)::int from public.products where business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2, 'staff see the product list (to pick products on a sale)');
select is(
  (select count(*)::int from public.get_product_stock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  2, 'staff see stock on hand');
select is(
  (select count(*)::int from public.stock_adjustments), 0, 'staff do not see stock adjustments');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'name', 'Staff product')) $$,
  '42501', 'not_allowed', 'staff cannot add products');
select throws_ok(
  $$ select public.create_stock_adjustment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object(
       'id', gen_random_uuid(), 'product_id', 'a0a0a0a0-0000-4000-8000-00000000a1ce',
       'adjustment_date', '2025-10-18', 'reason', 'lost', 'quantity', '1')) $$,
  '42501', 'not_allowed', 'staff cannot adjust stock');

select * from finish();
rollback;
