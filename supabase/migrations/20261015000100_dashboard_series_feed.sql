-- Phase 5: chart series, the unified transaction history and people totals
-- (SPEC Section 7.5). All SECURITY INVOKER, so Row Level Security applies.
-- Amounts come back as decimal strings; voided records never count.

-- ---------------------------------------------------------------------------
-- Sales, purchases, expenses and profit per month, for the p_months months ending with the
-- month of p_end (default: today in the business timezone). Every month is listed, with zeros.
-- ---------------------------------------------------------------------------
create function public.get_monthly_series(
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
  ),
  s as (
    select date_trunc('month', sale_date)::date as month, sum(total) as amount
    from public.sales
    where business_id = p_business_id and voided_at is null
      and sale_date >= (select min(month) from months)
      and sale_date < (select max(month) from months) + interval '1 month'
    group by 1
  ),
  p as (
    select date_trunc('month', purchase_date)::date as month, sum(total) as amount
    from public.purchases
    where business_id = p_business_id and voided_at is null
      and purchase_date >= (select min(month) from months)
      and purchase_date < (select max(month) from months) + interval '1 month'
    group by 1
  ),
  e as (
    select date_trunc('month', expense_date)::date as month, sum(amount) as amount
    from public.expenses
    where business_id = p_business_id and voided_at is null
      and expense_date >= (select min(month) from months)
      and expense_date < (select max(month) from months) + interval '1 month'
    group by 1
  )
  select m.month,
         coalesce(s.amount, 0)::numeric(14, 2)::text,
         coalesce(p.amount, 0)::numeric(14, 2)::text,
         coalesce(e.amount, 0)::numeric(14, 2)::text,
         (coalesce(s.amount, 0) - coalesce(p.amount, 0) - coalesce(e.amount, 0))::numeric(14, 2)::text
  from months m
  left join s on s.month = m.month
  left join p on p.month = m.month
  left join e on e.month = m.month
  order by m.month;
$$;

-- ---------------------------------------------------------------------------
-- Sales per day for a period (at most 366 days), every day listed.
-- ---------------------------------------------------------------------------
create function public.get_daily_series(p_business_id uuid, p_from date, p_to date)
returns table (day date, sales text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return query
  select d::date,
         coalesce(sum(s.total), 0)::numeric(14, 2)::text
  from generate_series(p_from, p_to, interval '1 day') as d
  left join public.sales s
    on s.business_id = p_business_id and s.voided_at is null and s.sale_date = d::date
  group by d
  order by d;
end;
$$;

revoke all on function public.get_monthly_series(uuid, integer, date) from public, anon;
revoke all on function public.get_daily_series(uuid, date, date) from public, anon;
grant execute on function public.get_monthly_series(uuid, integer, date) to authenticated;
grant execute on function public.get_daily_series(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Every money record in one list (SPEC 7.5 "transactions_feed").
-- `amount` is the record's own amount; money_in / money_out are set only for records
-- that move money (payments, expenses, other money). Sales and purchases are documents:
-- their money moves through their payments.
-- ---------------------------------------------------------------------------
create view public.transactions_feed
with (security_invoker = true)
as
select s.business_id, s.id, 'sale'::text as type, s.id as document_id, s.sale_date as date,
       s.customer_id as party_id, c.name as party_name, s.reference_no as reference,
       (select i.description from public.sale_items i
        where i.business_id = s.business_id and i.sale_id = s.id order by i.position limit 1) as description,
       s.total as amount, null::numeric as money_in, null::numeric as money_out, null::text as method,
       so.payment_status as status, so.due_status, s.voided_at, s.created_by, s.created_at
from public.sales s
join public.sales_overview so on so.id = s.id
left join public.customers c on c.business_id = s.business_id and c.id = s.customer_id
union all
select p.business_id, p.id, 'purchase', p.id, p.purchase_date,
       p.supplier_id, sp.name, p.reference_no,
       (select i.description from public.purchase_items i
        where i.business_id = p.business_id and i.purchase_id = p.id order by i.position limit 1),
       p.total, null, null, null,
       po.payment_status, po.due_status, p.voided_at, p.created_by, p.created_at
from public.purchases p
join public.purchases_overview po on po.id = p.id
left join public.suppliers sp on sp.business_id = p.business_id and sp.id = p.supplier_id
union all
select cp.business_id, cp.id, 'customer_payment', cp.sale_id, cp.payment_date,
       cp.customer_id, c.name, s.reference_no, cp.reference,
       cp.amount, cp.amount, null, cp.method,
       case when cp.voided_at is null then 'recorded' else 'voided' end, null, cp.voided_at, cp.created_by, cp.created_at
from public.customer_payments cp
join public.sales s on s.business_id = cp.business_id and s.id = cp.sale_id
left join public.customers c on c.business_id = cp.business_id and c.id = cp.customer_id
union all
select spay.business_id, spay.id, 'supplier_payment', spay.purchase_id, spay.payment_date,
       spay.supplier_id, sp.name, p.reference_no, spay.reference,
       spay.amount, null, spay.amount, spay.method,
       case when spay.voided_at is null then 'recorded' else 'voided' end, null, spay.voided_at, spay.created_by, spay.created_at
from public.supplier_payments spay
join public.purchases p on p.business_id = spay.business_id and p.id = spay.purchase_id
left join public.suppliers sp on sp.business_id = spay.business_id and sp.id = spay.supplier_id
union all
select e.business_id, e.id, 'expense', e.id, e.expense_date,
       e.category_id, ec.name, null, e.description,
       e.amount, null, e.amount, e.method,
       case when e.voided_at is null then 'recorded' else 'voided' end, null, e.voided_at, e.created_by, e.created_at
from public.expenses e
join public.expense_categories ec on ec.business_id = e.business_id and ec.id = e.category_id
union all
select ca.business_id, ca.id, case when ca.direction = 'in' then 'other_in' else 'other_out' end, ca.id, ca.entry_date,
       null, null, null, ca.type,
       ca.amount,
       case when ca.direction = 'in' then ca.amount end,
       case when ca.direction = 'out' then ca.amount end,
       ca.method,
       case when ca.voided_at is null then 'recorded' else 'voided' end, null, ca.voided_at, ca.created_by, ca.created_at
from public.cash_adjustments ca;

-- ---------------------------------------------------------------------------
-- Totals per customer and supplier (SPEC 7.5)
-- ---------------------------------------------------------------------------
create view public.customer_summary
with (security_invoker = true)
as
select c.business_id, c.id as customer_id, c.name,
       coalesce(sum(so.total) filter (where so.voided_at is null), 0)::numeric(14, 2) as total_sales,
       coalesce(sum(so.amount_paid) filter (where so.voided_at is null), 0)::numeric(14, 2) as total_paid,
       coalesce(sum(so.balance) filter (where so.voided_at is null), 0)::numeric(14, 2) as balance,
       count(so.id) filter (where so.voided_at is null) as sale_count
from public.customers c
left join public.sales_overview so on so.business_id = c.business_id and so.customer_id = c.id
group by c.business_id, c.id, c.name;

create view public.supplier_summary
with (security_invoker = true)
as
select sp.business_id, sp.id as supplier_id, sp.name,
       coalesce(sum(po.total) filter (where po.voided_at is null), 0)::numeric(14, 2) as total_purchases,
       coalesce(sum(po.amount_paid) filter (where po.voided_at is null), 0)::numeric(14, 2) as total_paid,
       coalesce(sum(po.balance) filter (where po.voided_at is null), 0)::numeric(14, 2) as balance,
       count(po.id) filter (where po.voided_at is null) as purchase_count
from public.suppliers sp
left join public.purchases_overview po on po.business_id = sp.business_id and po.supplier_id = sp.id
group by sp.business_id, sp.id, sp.name;

revoke all on table public.transactions_feed, public.customer_summary, public.supplier_summary from anon, authenticated;
grant select on table public.transactions_feed, public.customer_summary, public.supplier_summary to authenticated;
