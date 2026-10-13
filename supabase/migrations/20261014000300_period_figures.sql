-- Phase 4 (part 3): the money figures of SPEC Sections 3.4, 3.5 and 3.7, computed once,
-- in SQL, for the dashboard (Phase 5) and reports (Phase 6). Voided records are excluded
-- everywhere. Amounts are returned as decimal strings.
--
-- SECURITY INVOKER: Row Level Security applies, so a caller only ever sums rows they may
-- see. (Totals are an owner/manager feature; staff see only their own entries.)

-- Every money movement in one place: date, direction, method, amount.
-- Customer and supplier payments, expenses (paid when recorded) and other money in/out.
create view public.money_movements
with (security_invoker = true)
as
select cp.business_id, cp.payment_date as movement_date, 'in'::text as direction, cp.method,
       cp.amount, 'customer_payment'::text as source, cp.id as source_id
from public.customer_payments cp
where cp.voided_at is null
union all
select sp.business_id, sp.payment_date, 'out', sp.method, sp.amount, 'supplier_payment', sp.id
from public.supplier_payments sp
where sp.voided_at is null
union all
select e.business_id, e.expense_date, 'out', e.method, e.amount, 'expense', e.id
from public.expenses e
where e.voided_at is null
union all
select ca.business_id, ca.entry_date, ca.direction, ca.method, ca.amount, 'other_money', ca.id
from public.cash_adjustments ca
where ca.voided_at is null;

revoke all on table public.money_movements from anon, authenticated;
grant select on table public.money_movements to authenticated;

-- All dashboard card values (SPEC 3.4 and 3.5) for one period, in one call.
create function public.get_dashboard(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_today date;
  v_sales numeric;
  v_purchases numeric;
  v_expenses numeric;
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

  -- Period figures (3.4), by transaction date.
  select coalesce(sum(total), 0) into v_sales from public.sales
  where business_id = p_business_id and voided_at is null and sale_date between p_from and p_to;

  select coalesce(sum(total), 0) into v_purchases from public.purchases
  where business_id = p_business_id and voided_at is null and purchase_date between p_from and p_to;

  select coalesce(sum(amount), 0) into v_expenses from public.expenses
  where business_id = p_business_id and voided_at is null and expense_date between p_from and p_to;

  select coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_money_in, v_money_out
  from public.money_movements
  where business_id = p_business_id and movement_date between p_from and p_to;

  -- Point-in-time figures (3.5).
  select coalesce(sum(total), 0) into v_sales_today from public.sales
  where business_id = p_business_id and voided_at is null and sale_date = v_today;

  -- Cash Balance: starting cash plus everything in, minus everything out, from the
  -- starting balance date up to today (decision D3: earlier movements don't count).
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
    'sales', v_sales::numeric(14, 2)::text,
    'purchases', v_purchases::numeric(14, 2)::text,
    'expenses', v_expenses::numeric(14, 2)::text,
    'profit', (v_sales - v_purchases - v_expenses)::numeric(14, 2)::text,
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

-- Money In, Money Out and net per payment method for a period (SPEC 3.7). Always one row
-- per method, in the app's order, so the rows add up exactly to the period totals.
create function public.get_money_by_method(p_business_id uuid, p_from date, p_to date)
returns table (method text, money_in text, money_out text, net text)
language sql
stable
security invoker
set search_path = ''
as $$
  with methods (method, sort) as (
    values ('cash', 1), ('gcash', 2), ('maya', 3), ('bank_transfer', 4),
           ('card', 5), ('cheque', 6), ('other', 7)
  ),
  totals as (
    select m.method,
           coalesce(sum(mm.amount) filter (where mm.direction = 'in'), 0) as money_in,
           coalesce(sum(mm.amount) filter (where mm.direction = 'out'), 0) as money_out
    from public.money_movements mm
    join methods m on m.method = mm.method
    where mm.business_id = p_business_id and mm.movement_date between p_from and p_to
    group by m.method
  )
  select m.method,
         coalesce(t.money_in, 0)::numeric(14, 2)::text,
         coalesce(t.money_out, 0)::numeric(14, 2)::text,
         (coalesce(t.money_in, 0) - coalesce(t.money_out, 0))::numeric(14, 2)::text
  from methods m
  left join totals t on t.method = m.method
  order by m.sort;
$$;

revoke all on function public.get_dashboard(uuid, date, date) from public, anon;
revoke all on function public.get_money_by_method(uuid, date, date) from public, anon;
grant execute on function public.get_dashboard(uuid, date, date) to authenticated;
grant execute on function public.get_money_by_method(uuid, date, date) to authenticated;
