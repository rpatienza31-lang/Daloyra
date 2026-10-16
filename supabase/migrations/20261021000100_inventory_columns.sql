-- Inventory columns on the products list (owner request, 16 Oct; decision D69):
-- Received, Sold, Adjusted, Qty on hand, Total cost received, Average cost per piece and
-- Total current value, each computed here from non-voided records.
--   Received            = bought (purchase lines) + starting stock
--   Sold                = sale lines
--   Adjusted            = stock counts, damaged and lost (signed)
--   Qty on hand         = Received − Sold + Adjusted
--   Total cost received = purchase line totals + starting stock at its cost
--   Average cost        = Total cost received ÷ Received, rounded half-up to 2 decimals
--   Total current value = Qty on hand × selling price, rounded; 0 when nothing is on hand

drop function public.get_product_stock(uuid);

create function public.get_product_stock(p_business_id uuid)
returns table (
  product_id uuid,
  on_hand text,
  current_cost text,
  unit_profit text,
  received text,
  sold text,
  adjusted text,
  cost_received text,
  average_cost text,
  current_value text
)
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
    select pi.product_id, 'received'::text as kind, pi.quantity, pi.line_total as cost
    from public.purchase_items pi
    join public.purchases pu on pu.business_id = pi.business_id and pu.id = pi.purchase_id
    where pi.business_id = p_business_id and pi.product_id is not null and pu.voided_at is null
    union all
    select si.product_id, 'sold', si.quantity, 0
    from public.sale_items si
    join public.sales s on s.business_id = si.business_id and s.id = si.sale_id
    where si.business_id = p_business_id and si.product_id is not null and s.voided_at is null
    union all
    select sa.product_id, case when sa.reason = 'opening' then 'received' else 'adjusted' end,
           sa.quantity, case when sa.reason = 'opening' then sa.cost_total else 0 end
    from public.stock_adjustments sa
    where sa.business_id = p_business_id and sa.voided_at is null
  ),
  per as (
    select p.id, p.selling_price,
           coalesce(sum(m.quantity) filter (where m.kind = 'received'), 0) as received,
           coalesce(sum(m.quantity) filter (where m.kind = 'sold'), 0) as sold,
           coalesce(sum(m.quantity) filter (where m.kind = 'adjusted'), 0) as adjusted,
           coalesce(sum(m.cost) filter (where m.kind = 'received'), 0) as cost_received
    from public.products p
    left join moves m on m.product_id = p.id
    where p.business_id = p_business_id
    group by p.id, p.selling_price
  )
  select per.id,
         trim_scale((per.received - per.sold + per.adjusted)::numeric(14, 3))::text,
         c.cost::text,
         (per.selling_price - c.cost)::numeric(14, 2)::text,
         trim_scale(per.received::numeric(14, 3))::text,
         trim_scale(per.sold::numeric(14, 3))::text,
         trim_scale(per.adjusted::numeric(14, 3))::text,
         per.cost_received::numeric(14, 2)::text,
         case when per.received > 0
           then round(per.cost_received / per.received, 2)::numeric(14, 2)::text end,
         round(greatest(per.received - per.sold + per.adjusted, 0) * per.selling_price, 2)
           ::numeric(14, 2)::text
  from per
  cross join lateral (select private.product_cost(p_business_id, per.id, v_today) as cost) c;
end;
$$;

-- Totals for the products list: active products, or archived ones.
create function public.get_inventory_totals(p_business_id uuid, p_archived boolean default false)
returns table (products bigint, cost_received text, current_value text)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*),
         coalesce(sum(s.cost_received::numeric), 0)::numeric(14, 2)::text,
         coalesce(sum(s.current_value::numeric), 0)::numeric(14, 2)::text
  from public.get_product_stock(p_business_id) s
  join public.products p on p.business_id = p_business_id and p.id = s.product_id
  where (p.archived_at is not null) = coalesce(p_archived, false);
$$;

revoke all on function public.get_product_stock(uuid) from public, anon;
grant execute on function public.get_product_stock(uuid) to authenticated;
revoke all on function public.get_inventory_totals(uuid, boolean) from public, anon;
grant execute on function public.get_inventory_totals(uuid, boolean) to authenticated;
