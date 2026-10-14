-- Phase 9: products, stock and profit per product (decisions D49, D59–D64).
--
-- Money rules added here, once:
--   * a sale line can name a product; the database saves that product's cost on the line
--     when the sale is saved: the unit cost of its newest non-voided purchase dated on or
--     before the sale date, else the product's own purchase price (D59)
--   * cost_total = round(quantity × unit_cost, 2)              (generated column)
--   * stock on hand = bought − sold + adjustments, non-voided only; it may go below 0 (D60)
--   * Profit = Sales − Cost of products sold − Other purchases − Stock lost or damaged
--              − Expenses, where Other purchases = purchase totals − their product lines
--     (product purchases become stock, D61). With no products this is exactly the old rule.
--
-- Products and stock adjustments are written only through the functions below.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  unit text not null default 'pc' check (char_length(trim(unit)) between 1 and 20),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

-- One active product per name, ignoring capitals.
create unique index products_business_name_key
  on public.products (business_id, lower(name)) where archived_at is null;
create index products_business_idx on public.products (business_id, lower(name));

create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger products_stamp_actor before insert or update on public.products
  for each row execute function private.stamp_actor();
create trigger products_audit after insert or update on public.products
  for each row execute function private.audit_row();

alter table public.sale_items
  add column product_id uuid,
  add column unit_cost numeric(14, 2) check (unit_cost >= 0),
  add column cost_total numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  add foreign key (business_id, product_id) references public.products (business_id, id),
  add check ((product_id is null) = (unit_cost is null));

create index sale_items_business_product_idx on public.sale_items (business_id, product_id)
  where product_id is not null;

alter table public.purchase_items
  add column product_id uuid,
  add foreign key (business_id, product_id) references public.products (business_id, id);

create index purchase_items_business_product_idx on public.purchase_items (business_id, product_id)
  where product_id is not null;

-- Opening stock, counts and losses (D62). quantity is signed: + adds stock, − removes it.
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  adjustment_date date not null,
  reason text not null check (reason in ('opening', 'count', 'damaged', 'lost')),
  quantity numeric(12, 3) not null check (quantity <> 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  cost_total numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, product_id) references public.products (business_id, id),
  check ((reason = 'opening' and quantity > 0)
         or (reason in ('damaged', 'lost') and quantity < 0)
         or reason = 'count'),
  check ((voided_at is null) = (void_reason is null))
);

create index stock_adjustments_business_product_idx
  on public.stock_adjustments (business_id, product_id, adjustment_date);
create index stock_adjustments_business_date_idx
  on public.stock_adjustments (business_id, adjustment_date);

create trigger stock_adjustments_set_updated_at before update on public.stock_adjustments
  for each row execute function private.set_updated_at();
create trigger stock_adjustments_stamp_actor before insert or update on public.stock_adjustments
  for each row execute function private.stamp_actor();
create trigger stock_adjustments_guard_unvoid before update on public.stock_adjustments
  for each row execute function private.guard_unvoid();
create trigger stock_adjustments_audit after insert or update on public.stock_adjustments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone in the business reads products (they are picked on a sale);
-- stock adjustments are read by owners and managers. No direct writes.
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.stock_adjustments enable row level security;

revoke all on table public.products, public.stock_adjustments from anon, authenticated;
grant select on table public.products, public.stock_adjustments to authenticated;

create policy products_select on public.products
  for select to authenticated
  using (business_id in (select private.my_business_ids()));

create policy stock_adjustments_select on public.stock_adjustments
  for select to authenticated
  using (business_id in (select private.my_business_ids(array['owner', 'manager'])));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The cost of one unit of a product on a date (D59).
create function private.product_cost(p_business_id uuid, p_product_id uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pi.unit_cost
     from public.purchase_items pi
     join public.purchases pu on pu.business_id = pi.business_id and pu.id = pi.purchase_id
     where pi.business_id = p_business_id and pi.product_id = p_product_id
       and pu.voided_at is null and pu.purchase_date <= p_date
     order by pu.purchase_date desc, pu.created_at desc, pi.position desc
     limit 1),
    (select p.purchase_price from public.products p
     where p.business_id = p_business_id and p.id = p_product_id),
    0)::numeric(14, 2);
$$;

revoke all on function private.product_cost(uuid, uuid, date) from public;

-- A product of this business (archived ones too, so older documents can still be edited),
-- or null for a free-text line.
create function private.item_product(p_business_id uuid, p_value text)
returns public.products
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(trim(p_value), '')::uuid;
  v_product public.products;
begin
  if v_id is null then
    return null;
  end if;
  select * into v_product from public.products where business_id = p_business_id and id = v_id;
  if not found then
    raise exception 'product_not_found' using errcode = '22023';
  end if;
  return v_product;
end;
$$;

revoke all on function private.item_product(uuid, text) from public;

create function private.product_name_free(p_business_id uuid, p_name text, p_except uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.products
    where business_id = p_business_id and lower(name) = lower(trim(p_name))
      and archived_at is null and id is distinct from p_except
  ) then
    raise exception 'product_name_taken' using errcode = '23505';
  end if;
end;
$$;

revoke all on function private.product_name_free(uuid, text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Sale and purchase lines: an optional product_id per line
-- ---------------------------------------------------------------------------

create or replace function private.insert_sale_items(p_business_id uuid, p_sale_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer;
  v_product public.products;
  v_sale_date date;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100
  then
    raise exception 'items_required' using errcode = '22023';
  end if;

  select sale_date into v_sale_date from public.sales where business_id = p_business_id and id = p_sale_id;

  for v_item, v_position in
    select value, ordinality::integer - 1 from jsonb_array_elements(p_items) with ordinality
  loop
    v_product := private.item_product(p_business_id, v_item ->> 'product_id');
    if coalesce(nullif(trim(v_item ->> 'description'), ''), v_product.name) is null then
      raise exception 'description_required' using errcode = '22023';
    end if;
    insert into public.sale_items
      (business_id, sale_id, description, quantity, unit_price, position, product_id, unit_cost)
    values (
      p_business_id,
      p_sale_id,
      left(coalesce(nullif(trim(v_item ->> 'description'), ''), v_product.name), 200),
      private.parse_quantity(v_item ->> 'quantity'),
      private.parse_amount(v_item ->> 'unit_price', 'unit_price', true),
      v_position,
      v_product.id,
      case when v_product.id is not null
        then private.product_cost(p_business_id, v_product.id, v_sale_date) end
    );
  end loop;
end;
$$;

create or replace function private.insert_purchase_items(p_business_id uuid, p_purchase_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer;
  v_product public.products;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100
  then
    raise exception 'items_required' using errcode = '22023';
  end if;

  for v_item, v_position in
    select value, ordinality::integer - 1 from jsonb_array_elements(p_items) with ordinality
  loop
    v_product := private.item_product(p_business_id, v_item ->> 'product_id');
    if coalesce(nullif(trim(v_item ->> 'description'), ''), v_product.name) is null then
      raise exception 'description_required' using errcode = '22023';
    end if;
    insert into public.purchase_items
      (business_id, purchase_id, description, quantity, unit_cost, position, product_id)
    values (
      p_business_id,
      p_purchase_id,
      left(coalesce(nullif(trim(v_item ->> 'description'), ''), v_product.name), 200),
      private.parse_quantity(v_item ->> 'quantity'),
      private.parse_amount(v_item ->> 'unit_cost', 'unit_cost', true),
      v_position,
      v_product.id
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product write functions (owner and manager)
-- ---------------------------------------------------------------------------

-- p_product: { id, name, unit?, selling_price, purchase_price, opening_stock? }
create function public.create_product(p_business_id uuid, p_product jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_product ->> 'id')::uuid;
  v_name text := left(nullif(trim(p_product ->> 'name'), ''), 120);
  v_opening text := nullif(trim(p_product ->> 'opening_stock'), '');
  v_price numeric;
  v_qty numeric;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_id is null or v_name is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.products where id = v_id) then
    if exists (
      select 1 from public.products
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  perform private.product_name_free(p_business_id, v_name);
  v_price := private.parse_amount(coalesce(nullif(trim(p_product ->> 'purchase_price'), ''), '0'), 'purchase_price', true);

  insert into public.products (id, business_id, name, unit, selling_price, purchase_price)
  values (
    v_id,
    p_business_id,
    v_name,
    coalesce(left(nullif(trim(p_product ->> 'unit'), ''), 20), 'pc'),
    private.parse_amount(coalesce(nullif(trim(p_product ->> 'selling_price'), ''), '0'), 'selling_price', true),
    v_price
  );

  if v_opening is not null and v_opening !~ '^0+(\.0*)?$' then
    v_qty := private.parse_quantity(v_opening);
    insert into public.stock_adjustments (business_id, product_id, adjustment_date, reason, quantity, unit_cost)
    values (
      p_business_id, v_id,
      (select (now() at time zone b.timezone)::date from public.businesses b where b.id = p_business_id),
      'opening', v_qty, v_price
    );
  end if;
  return v_id;
end;
$$;

-- p_product: { id, name, unit?, selling_price, purchase_price }
create function public.update_product(p_business_id uuid, p_product jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_product ->> 'id')::uuid;
  v_name text := left(nullif(trim(p_product ->> 'name'), ''), 120);
  v_product public.products;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  select * into v_product from public.products where business_id = p_business_id and id = v_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_name is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_product.archived_at is null then
    perform private.product_name_free(p_business_id, v_name, v_id);
  end if;

  update public.products
  set name = v_name,
      unit = coalesce(left(nullif(trim(p_product ->> 'unit'), ''), 20), 'pc'),
      selling_price = private.parse_amount(
        coalesce(nullif(trim(p_product ->> 'selling_price'), ''), '0'), 'selling_price', true),
      purchase_price = private.parse_amount(
        coalesce(nullif(trim(p_product ->> 'purchase_price'), ''), '0'), 'purchase_price', true)
  where business_id = p_business_id and id = v_id;
end;
$$;

create function public.set_product_archived(p_business_id uuid, p_product_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  select * into v_product from public.products where business_id = p_business_id and id = p_product_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_archived then
    update public.products set archived_at = coalesce(archived_at, now())
    where business_id = p_business_id and id = p_product_id;
  else
    perform private.product_name_free(p_business_id, v_product.name, p_product_id);
    update public.products set archived_at = null
    where business_id = p_business_id and id = p_product_id;
  end if;
end;
$$;

-- p_entry: { id, product_id, adjustment_date, reason, direction ('add'|'remove', count only),
--            quantity (positive decimal string), notes? }
create function public.create_stock_adjustment(p_business_id uuid, p_entry jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_entry ->> 'id')::uuid;
  v_date date := (p_entry ->> 'adjustment_date')::date;
  v_reason text := p_entry ->> 'reason';
  v_product public.products;
  v_qty numeric;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_id is null or v_date is null or v_reason is null
    or v_reason not in ('opening', 'count', 'damaged', 'lost')
  then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.stock_adjustments where id = v_id) then
    if exists (
      select 1 from public.stock_adjustments
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_product := private.item_product(p_business_id, p_entry ->> 'product_id');
  if v_product.id is null then
    raise exception 'product_not_found' using errcode = '22023';
  end if;

  v_qty := private.parse_quantity(p_entry ->> 'quantity');
  if v_reason in ('damaged', 'lost')
    or (v_reason = 'count' and coalesce(p_entry ->> 'direction', '') = 'remove')
  then
    v_qty := -v_qty;
  elsif v_reason = 'count' and coalesce(p_entry ->> 'direction', '') <> 'add' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  insert into public.stock_adjustments
    (id, business_id, product_id, adjustment_date, reason, quantity, unit_cost, notes)
  values (
    v_id, p_business_id, v_product.id, v_date, v_reason, v_qty,
    private.product_cost(p_business_id, v_product.id, v_date),
    nullif(left(trim(p_entry ->> 'notes'), 500), '')
  );
  return v_id;
end;
$$;

create function public.void_stock_adjustment(p_business_id uuid, p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(left(trim(p_reason), 300), '');
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.stock_adjustments where business_id = p_business_id and id = p_entry_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.stock_adjustments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_entry_id and voided_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock: on hand, the cost the next sale would use, and the profit on one at the selling
-- price, per product, for every member. SECURITY DEFINER because staff cannot read purchases.
-- ---------------------------------------------------------------------------

create function public.get_product_stock(p_business_id uuid)
returns table (product_id uuid, on_hand text, current_cost text, unit_profit text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  if p_business_id is null or p_business_id not in (select private.my_business_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select (now() at time zone b.timezone)::date into v_today from public.businesses b where b.id = p_business_id;

  return query
  with moves as (
    select pi.product_id, pi.quantity
    from public.purchase_items pi
    join public.purchases pu on pu.business_id = pi.business_id and pu.id = pi.purchase_id
    where pi.business_id = p_business_id and pi.product_id is not null and pu.voided_at is null
    union all
    select si.product_id, -si.quantity
    from public.sale_items si
    join public.sales s on s.business_id = si.business_id and s.id = si.sale_id
    where si.business_id = p_business_id and si.product_id is not null and s.voided_at is null
    union all
    select sa.product_id, sa.quantity
    from public.stock_adjustments sa
    where sa.business_id = p_business_id and sa.voided_at is null
  )
  select p.id,
         trim_scale(coalesce((select sum(m.quantity) from moves m where m.product_id = p.id), 0)::numeric(14, 3))::text,
         c.cost::text,
         (p.selling_price - c.cost)::numeric(14, 2)::text
  from public.products p
  cross join lateral (select private.product_cost(p_business_id, p.id, v_today) as cost) c
  where p.business_id = p_business_id;
end;
$$;

-- Every stock movement of one product, newest first (owners and managers; RLS applies).
create function public.get_product_movements(p_business_id uuid, p_product_id uuid)
returns table (
  id uuid,
  kind text,
  document_id uuid,
  date date,
  reference text,
  quantity text,
  unit_amount text,
  unit_cost text,
  reason text,
  notes text,
  voided boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from (
    select si.id, 'sale'::text, s.id, s.sale_date, s.reference_no,
           trim_scale(-si.quantity)::text, si.unit_price::text, si.unit_cost::text,
           null::text, null::text, s.voided_at is not null, s.created_at
    from public.sale_items si
    join public.sales s on s.business_id = si.business_id and s.id = si.sale_id
    where si.business_id = p_business_id and si.product_id = p_product_id
    union all
    select pi.id, 'purchase', pu.id, pu.purchase_date, pu.reference_no,
           trim_scale(pi.quantity)::text, pi.unit_cost::text, pi.unit_cost::text,
           null, null, pu.voided_at is not null, pu.created_at
    from public.purchase_items pi
    join public.purchases pu on pu.business_id = pi.business_id and pu.id = pi.purchase_id
    where pi.business_id = p_business_id and pi.product_id = p_product_id
    union all
    select sa.id, 'adjustment', sa.id, sa.adjustment_date, null,
           trim_scale(sa.quantity)::text, null, sa.unit_cost::text,
           sa.reason, coalesce(sa.void_reason, sa.notes), sa.voided_at is not null, sa.created_at
    from public.stock_adjustments sa
    where sa.business_id = p_business_id and sa.product_id = p_product_id
  ) m
  order by 4 desc, 12 desc
  limit 300;
$$;

-- ---------------------------------------------------------------------------
-- Profit (new rule), once, for the dashboard, the charts and the reports.
-- Null dates mean "all dates". SECURITY INVOKER: callers sum only rows they may see.
-- ---------------------------------------------------------------------------

create function private.profit_parts(p_business_id uuid, p_from date, p_to date)
returns table (
  sales numeric,
  purchases numeric,
  cost_of_sales numeric,
  other_purchases numeric,
  stock_losses numeric,
  expenses numeric,
  profit numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (select coalesce(p_from, '-infinity'::date) as f, coalesce(p_to, 'infinity'::date) as t),
  s as (
    select coalesce(sum(total), 0) as v from public.sales, r
    where business_id = p_business_id and voided_at is null and sale_date between r.f and r.t
  ),
  c as (
    select coalesce(sum(si.cost_total), 0) as v
    from public.sale_items si
    join public.sales x on x.business_id = si.business_id and x.id = si.sale_id, r
    where si.business_id = p_business_id and si.product_id is not null
      and x.voided_at is null and x.sale_date between r.f and r.t
  ),
  p as (
    select coalesce(sum(total), 0) as v from public.purchases, r
    where business_id = p_business_id and voided_at is null and purchase_date between r.f and r.t
  ),
  ps as (
    select coalesce(sum(pi.line_total), 0) as v
    from public.purchase_items pi
    join public.purchases x on x.business_id = pi.business_id and x.id = pi.purchase_id, r
    where pi.business_id = p_business_id and pi.product_id is not null
      and x.voided_at is null and x.purchase_date between r.f and r.t
  ),
  l as (
    select coalesce(-sum(cost_total), 0) as v from public.stock_adjustments, r
    where business_id = p_business_id and voided_at is null and reason in ('damaged', 'lost')
      and adjustment_date between r.f and r.t
  ),
  e as (
    select coalesce(sum(amount), 0) as v from public.expenses, r
    where business_id = p_business_id and voided_at is null and expense_date between r.f and r.t
  )
  select s.v, p.v, c.v, p.v - ps.v, l.v, e.v, s.v - c.v - (p.v - ps.v) - l.v - e.v
  from s, c, p, ps, l, e;
$$;

revoke all on function private.profit_parts(uuid, date, date) from public;
grant execute on function private.profit_parts(uuid, date, date) to authenticated;

create or replace function public.get_dashboard(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_today date;
  v_parts record;
  v_money_in numeric;
  v_money_out numeric;
  v_sales_today numeric;
  v_cash numeric;
  v_collect numeric;
  v_pay numeric;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_today := (now() at time zone v_business.timezone)::date;

  -- Period figures (3.4), by transaction date; Profit by the Phase 9 rule.
  select * into v_parts from private.profit_parts(p_business_id, p_from, p_to);

  select coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_money_in, v_money_out
  from public.money_movements
  where business_id = p_business_id and movement_date between p_from and p_to;

  -- Point-in-time figures (3.5).
  select coalesce(sum(total), 0) into v_sales_today from public.sales
  where business_id = p_business_id and voided_at is null and sale_date = v_today;

  select v_business.starting_cash_balance
         + coalesce(sum(amount) filter (where direction = 'in'), 0)
         - coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_cash
  from public.money_movements
  where business_id = p_business_id
    and movement_date between v_business.starting_balance_date and v_today;

  select coalesce(sum(balance), 0) into v_collect from public.sales_overview
  where business_id = p_business_id and voided_at is null;

  select coalesce(sum(balance), 0) into v_pay from public.purchases_overview
  where business_id = p_business_id and voided_at is null;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'today', v_today,
    'sales', v_parts.sales::numeric(14, 2)::text,
    'purchases', v_parts.purchases::numeric(14, 2)::text,
    'expenses', v_parts.expenses::numeric(14, 2)::text,
    'cost_of_sales', v_parts.cost_of_sales::numeric(14, 2)::text,
    'other_purchases', v_parts.other_purchases::numeric(14, 2)::text,
    'stock_losses', v_parts.stock_losses::numeric(14, 2)::text,
    'profit', v_parts.profit::numeric(14, 2)::text,
    'money_in', v_money_in::numeric(14, 2)::text,
    'money_out', v_money_out::numeric(14, 2)::text,
    'net_cash_flow', (v_money_in - v_money_out)::numeric(14, 2)::text,
    'sales_today', v_sales_today::numeric(14, 2)::text,
    'cash_balance', v_cash::numeric(14, 2)::text,
    'amount_to_collect', v_collect::numeric(14, 2)::text,
    'amount_to_pay', v_pay::numeric(14, 2)::text
  );
end;
$$;

create or replace function public.get_monthly_series(
  p_business_id uuid,
  p_months integer default 12,
  p_end date default null
)
returns table (month date, sales text, purchases text, expenses text, profit text)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select date_trunc('month', coalesce(p_end, (now() at time zone timezone)::date))::date as this_month
    from public.businesses where id = p_business_id
  ),
  months as (
    select (b.this_month - make_interval(months => g))::date as month
    from b, generate_series(0, least(greatest(coalesce(p_months, 12), 1), 60) - 1) as g
  )
  select m.month,
         x.sales::numeric(14, 2)::text,
         x.purchases::numeric(14, 2)::text,
         x.expenses::numeric(14, 2)::text,
         x.profit::numeric(14, 2)::text
  from months m
  cross join lateral private.profit_parts(
    p_business_id, m.month, (m.month + interval '1 month' - interval '1 day')::date) x
  order by m.month;
$$;

create or replace function public.report_profit_loss(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_parts record;
  v_expenses jsonb;
begin
  perform public.report_business(p_business_id, p_from, p_to);
  select * into v_parts from private.profit_parts(p_business_id, p_from, p_to);
  v_expenses := public.report_expenses(p_business_id, p_from, p_to);
  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'rows', v_expenses -> 'rows',
    'totals', jsonb_build_object(
      'sales', v_parts.sales::numeric(14, 2)::text,
      'cost_of_sales', v_parts.cost_of_sales::numeric(14, 2)::text,
      'purchases', v_parts.other_purchases::numeric(14, 2)::text,
      'stock_losses', v_parts.stock_losses::numeric(14, 2)::text,
      'expenses', v_expenses -> 'totals' ->> 'amount',
      'profit', v_parts.profit::numeric(14, 2)::text));
end;
$$;

-- Profit per product for the period: quantity sold, sales, cost and profit of each product
-- (line amounts, before any discount on the whole sale). Free-text lines and sale discounts
-- are given as totals only, so the figures reconcile with the Sales report.
create function public.report_profit_by_product(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, '-infinity');
  v_to date := coalesce(p_to, 'infinity');
  v_rows jsonb;
  v_totals jsonb;
  v_other numeric;
  v_discounts numeric;
begin
  perform public.report_business(p_business_id, p_from, p_to);

  with lines as (
    select si.product_id, si.quantity, si.line_total, si.cost_total
    from public.sale_items si
    join public.sales s on s.business_id = si.business_id and s.id = si.sale_id
    where si.business_id = p_business_id and si.product_id is not null
      and s.voided_at is null and s.sale_date between v_from and v_to
  ),
  by_product as (
    select l.product_id, p.name, p.unit, sum(l.quantity) as quantity,
           sum(l.line_total) as sales, sum(l.cost_total) as cost
    from lines l
    join public.products p on p.business_id = p_business_id and p.id = l.product_id
    group by l.product_id, p.name, p.unit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'product', name, 'unit', unit,
           'quantity', trim_scale(quantity)::text,
           'sales', sales::numeric(14, 2)::text, 'cost', cost::numeric(14, 2)::text,
           'profit', (sales - cost)::numeric(14, 2)::text)
         order by (sales - cost) desc, name), '[]'::jsonb),
         jsonb_build_object(
           'sales', coalesce(sum(sales), 0)::numeric(14, 2)::text,
           'cost', coalesce(sum(cost), 0)::numeric(14, 2)::text,
           'profit', coalesce(sum(sales - cost), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from by_product;

  select coalesce(sum(si.line_total), 0) into v_other
  from public.sale_items si
  join public.sales s on s.business_id = si.business_id and s.id = si.sale_id
  where si.business_id = p_business_id and si.product_id is null
    and s.voided_at is null and s.sale_date between v_from and v_to;

  select coalesce(sum(discount_amount), 0) into v_discounts
  from public.sales
  where business_id = p_business_id and voided_at is null and sale_date between v_from and v_to;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'rows', v_rows,
    'totals', v_totals || jsonb_build_object(
      'other_items', v_other::numeric(14, 2)::text,
      'discounts', v_discounts::numeric(14, 2)::text));
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity log: names for the new records
-- ---------------------------------------------------------------------------

create or replace function private.audit_value(p_business_id uuid, p_field text, p_value jsonb)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then null
    when p_field = 'customer_id' then
      (select c.name from public.customers c where c.business_id = p_business_id and c.id = (p_value #>> '{}')::uuid)
    when p_field = 'supplier_id' then
      (select s.name from public.suppliers s where s.business_id = p_business_id and s.id = (p_value #>> '{}')::uuid)
    when p_field = 'category_id' then
      (select c.name from public.expense_categories c where c.business_id = p_business_id and c.id = (p_value #>> '{}')::uuid)
    when p_field = 'product_id' then
      (select p.name from public.products p where p.business_id = p_business_id and p.id = (p_value #>> '{}')::uuid)
    when p_field = 'quantity' then trim_scale((p_value #>> '{}')::numeric)::text
    when p_field = 'items' then
      (select string_agg(
                concat_ws(' ', i ->> 'description', '×', trim_scale((i ->> 'quantity')::numeric)::text, '@',
                          coalesce(i ->> 'unit_price', i ->> 'unit_cost')),
                '; ' order by (i ->> 'position')::int)
       from jsonb_array_elements(p_value) i)
    else p_value #>> '{}'
  end;
$$;

create or replace function public.get_activity(
  p_business_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_table text default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  table_name text,
  record_id uuid,
  parent_id uuid,
  action text,
  actor_name text,
  label text,
  amount text,
  reason text,
  changes jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id,
         a.created_at,
         a.table_name,
         a.record_id,
         coalesce(a.new_data ->> 'sale_id', a.new_data ->> 'purchase_id', a.new_data ->> 'product_id')::uuid,
         a.action,
         private.member_name(a.business_id, a.actor_id),
         case a.table_name
           when 'sales' then a.new_data ->> 'reference_no'
           when 'purchases' then a.new_data ->> 'reference_no'
           when 'customer_payments' then
             (select s.reference_no from public.sales s
              where s.business_id = a.business_id and s.id = (a.new_data ->> 'sale_id')::uuid)
           when 'supplier_payments' then
             (select p.reference_no from public.purchases p
              where p.business_id = a.business_id and p.id = (a.new_data ->> 'purchase_id')::uuid)
           when 'expenses' then coalesce(
             nullif(a.new_data ->> 'description', ''),
             private.audit_value(a.business_id, 'category_id', a.new_data -> 'category_id'))
           when 'cash_adjustments' then a.new_data ->> 'type'
           when 'businesses' then a.new_data ->> 'name'
           when 'products' then a.new_data ->> 'name'
           when 'stock_adjustments' then
             private.audit_value(a.business_id, 'product_id', a.new_data -> 'product_id')
         end,
         coalesce(a.new_data ->> 'total', a.new_data ->> 'amount'),
         a.new_data ->> 'void_reason',
         case when a.action = 'create' or a.old_data is null then '[]'::jsonb else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'field', k.key,
                    'old', private.audit_value(a.business_id, k.key, a.old_data -> k.key),
                    'new', private.audit_value(a.business_id, k.key, a.new_data -> k.key))
                  order by k.key)
           from jsonb_object_keys(a.new_data) as k(key)
           where k.key not in ('id', 'business_id', 'created_at', 'created_by', 'updated_at',
                               'updated_by', 'voided_at', 'voided_by', 'subtotal', 'sale_id',
                               'purchase_id', 'search_text', 'cost_total', 'unit_cost')
             and (a.old_data -> k.key) is distinct from (a.new_data -> k.key)), '[]'::jsonb)
         end
  from public.audit_logs a
  where a.business_id = p_business_id
    and (p_before is null
         or a.created_at < p_before
         or (a.created_at = p_before and p_before_id is not null and a.id < p_before_id))
    and (p_table is null or a.table_name = p_table)
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_product(uuid, jsonb)',
    'update_product(uuid, jsonb)',
    'set_product_archived(uuid, uuid, boolean)',
    'create_stock_adjustment(uuid, jsonb)',
    'void_stock_adjustment(uuid, uuid, text)',
    'get_product_stock(uuid)',
    'get_product_movements(uuid, uuid)',
    'report_profit_by_product(uuid, date, date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
