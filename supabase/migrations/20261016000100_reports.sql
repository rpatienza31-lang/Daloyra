-- Phase 6: the ten reports (SPEC Section 10). Every row and every total is computed here,
-- with the same rules as get_dashboard, so reports, dashboard and history agree to the
-- centavo. Voided records never count.
--
-- Each function returns jsonb: { "from", "to", "rows": [...], "totals": {...} }, amounts as
-- decimal strings. p_from / p_to may be null for "all dates". SECURITY INVOKER: Row Level
-- Security applies, and a business the caller cannot see raises not_found.

-- Checks the arguments and returns the business (visible to the caller) or raises.
create function public.report_business(p_business_id uuid, p_from date, p_to date)
returns public.businesses
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
begin
  select * into v_business from public.businesses where id = p_business_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_from > p_to then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return v_business;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Sales and 2. Purchases: every document in the period with total, paid and balance.
-- ---------------------------------------------------------------------------
create function public.report_sales(p_business_id uuid, p_from date, p_to date)
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
begin
  perform public.report_business(p_business_id, p_from, p_to);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'date', sale_date, 'reference', reference_no, 'party', customer_name,
           'total', total::text, 'paid', amount_paid::text, 'balance', balance::text,
           'status', payment_status, 'due_status', due_status)
         order by sale_date, reference_no), '[]'::jsonb),
         jsonb_build_object(
           'count', count(*),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(amount_paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from public.sales_overview
  where business_id = p_business_id and voided_at is null and sale_date between v_from and v_to;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

create function public.report_purchases(p_business_id uuid, p_from date, p_to date)
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
begin
  perform public.report_business(p_business_id, p_from, p_to);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'date', purchase_date, 'reference', reference_no, 'party', supplier_name,
           'total', total::text, 'paid', amount_paid::text, 'balance', balance::text,
           'status', payment_status, 'due_status', due_status)
         order by purchase_date, reference_no), '[]'::jsonb),
         jsonb_build_object(
           'count', count(*),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(amount_paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from public.purchases_overview
  where business_id = p_business_id and voided_at is null and purchase_date between v_from and v_to;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Expenses by category
-- ---------------------------------------------------------------------------
create function public.report_expenses(p_business_id uuid, p_from date, p_to date)
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
begin
  perform public.report_business(p_business_id, p_from, p_to);
  with by_category as (
    select c.id, c.name, count(*) as n, sum(e.amount) as amount
    from public.expenses e
    join public.expense_categories c on c.business_id = e.business_id and c.id = e.category_id
    where e.business_id = p_business_id and e.voided_at is null
      and e.expense_date between v_from and v_to
    group by c.id, c.name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'category', name, 'count', n, 'amount', amount::numeric(14, 2)::text)
         order by amount desc, name), '[]'::jsonb),
         jsonb_build_object(
           'count', coalesce(sum(n), 0),
           'amount', coalesce(sum(amount), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from by_category;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Profit and Loss Summary: Sales − Purchases − Expenses (by category) = Profit (SPEC 3.4)
-- ---------------------------------------------------------------------------
create function public.report_profit_loss(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, '-infinity');
  v_to date := coalesce(p_to, 'infinity');
  v_sales numeric;
  v_purchases numeric;
  v_expenses jsonb;
begin
  perform public.report_business(p_business_id, p_from, p_to);
  select coalesce(sum(total), 0) into v_sales from public.sales
  where business_id = p_business_id and voided_at is null and sale_date between v_from and v_to;
  select coalesce(sum(total), 0) into v_purchases from public.purchases
  where business_id = p_business_id and voided_at is null and purchase_date between v_from and v_to;
  v_expenses := public.report_expenses(p_business_id, p_from, p_to);
  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'rows', v_expenses -> 'rows',
    'totals', jsonb_build_object(
      'sales', v_sales::numeric(14, 2)::text,
      'purchases', v_purchases::numeric(14, 2)::text,
      'expenses', v_expenses -> 'totals' ->> 'amount',
      'profit', (v_sales - v_purchases - (v_expenses -> 'totals' ->> 'amount')::numeric)
                  ::numeric(14, 2)::text));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cash Flow Summary: Money In and Money Out by kind for the period (same as the
-- dashboard), with the cash at the start and at the end. Balances follow the Cash Balance
-- rule (decision D3): starting cash plus movements from the starting balance date. The end
-- balance is taken at the period's end or today, whichever comes first.
-- ---------------------------------------------------------------------------
create function public.report_cash_flow(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_from date := coalesce(p_from, '-infinity');
  v_to date := coalesce(p_to, 'infinity');
  v_today date;
  v_opening_date date;
  v_closing_date date;
  v_rows jsonb;
  v_in numeric;
  v_out numeric;
begin
  v_business := public.report_business(p_business_id, p_from, p_to);
  v_today := (now() at time zone v_business.timezone)::date;
  v_opening_date := greatest(v_from, v_business.starting_balance_date);
  v_closing_date := least(v_to, v_today);

  with lines as (
    select mm.direction,
           case when mm.source = 'other_money' then 'other_' || ca.type else mm.source end as line,
           sum(mm.amount) as amount
    from public.money_movements mm
    left join public.cash_adjustments ca
      on mm.source = 'other_money' and ca.business_id = mm.business_id and ca.id = mm.source_id
    where mm.business_id = p_business_id and mm.movement_date between v_from and v_to
    group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'direction', direction, 'line', line, 'amount', amount::numeric(14, 2)::text)
         order by direction, amount desc, line), '[]'::jsonb),
         coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_rows, v_in, v_out
  from lines;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'rows', v_rows,
    'totals', jsonb_build_object(
      'money_in', v_in::numeric(14, 2)::text,
      'money_out', v_out::numeric(14, 2)::text,
      'net', (v_in - v_out)::numeric(14, 2)::text,
      'opening_date', v_opening_date,
      'opening', (v_business.starting_cash_balance + coalesce((
        select sum(case when direction = 'in' then amount else -amount end)
        from public.money_movements
        where business_id = p_business_id
          and movement_date >= v_business.starting_balance_date
          and movement_date < v_opening_date), 0))::numeric(14, 2)::text,
      'closing_date', v_closing_date,
      'closing', (v_business.starting_cash_balance + coalesce((
        select sum(case when direction = 'in' then amount else -amount end)
        from public.money_movements
        where business_id = p_business_id
          and movement_date between v_business.starting_balance_date and v_closing_date), 0))
        ::numeric(14, 2)::text));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Payment Method Summary (SPEC 3.7): Money In, Money Out and net per method.
-- ---------------------------------------------------------------------------
create function public.report_payment_methods(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_totals jsonb;
begin
  perform public.report_business(p_business_id, p_from, p_to);
  select jsonb_agg(jsonb_build_object(
           'method', method, 'money_in', money_in, 'money_out', money_out, 'net', net)),
         jsonb_build_object(
           'money_in', sum(money_in::numeric)::numeric(14, 2)::text,
           'money_out', sum(money_out::numeric)::numeric(14, 2)::text,
           'net', sum(net::numeric)::numeric(14, 2)::text)
  into v_rows, v_totals
  from public.get_money_by_method(p_business_id, coalesce(p_from, '-infinity'), coalesce(p_to, 'infinity'));
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. To Collect and 8. To Pay: documents with money still owed, by document date,
-- the earliest due first, with days overdue.
-- ---------------------------------------------------------------------------
create function public.report_to_collect(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_from date := coalesce(p_from, '-infinity');
  v_to date := coalesce(p_to, 'infinity');
  v_today date;
  v_rows jsonb;
  v_totals jsonb;
begin
  v_business := public.report_business(p_business_id, p_from, p_to);
  v_today := (now() at time zone v_business.timezone)::date;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'date', sale_date, 'reference', reference_no, 'party', customer_name,
           'due_date', due_date, 'due_status', due_status,
           'days_overdue', case when due_date < v_today then v_today - due_date end,
           'total', total::text, 'paid', amount_paid::text, 'balance', balance::text)
         order by due_date nulls last, sale_date, reference_no), '[]'::jsonb),
         jsonb_build_object(
           'count', count(*),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(amount_paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text,
           'overdue', coalesce(sum(balance) filter (where due_status = 'overdue'), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from public.sales_overview
  where business_id = p_business_id and voided_at is null and balance > 0
    and sale_date between v_from and v_to;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

create function public.report_to_pay(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_from date := coalesce(p_from, '-infinity');
  v_to date := coalesce(p_to, 'infinity');
  v_today date;
  v_rows jsonb;
  v_totals jsonb;
begin
  v_business := public.report_business(p_business_id, p_from, p_to);
  v_today := (now() at time zone v_business.timezone)::date;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'date', purchase_date, 'reference', reference_no, 'party', supplier_name,
           'due_date', due_date, 'due_status', due_status,
           'days_overdue', case when due_date < v_today then v_today - due_date end,
           'total', total::text, 'paid', amount_paid::text, 'balance', balance::text)
         order by due_date nulls last, purchase_date, reference_no), '[]'::jsonb),
         jsonb_build_object(
           'count', count(*),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(amount_paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text,
           'overdue', coalesce(sum(balance) filter (where due_status = 'overdue'), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from public.purchases_overview
  where business_id = p_business_id and voided_at is null and balance > 0
    and purchase_date between v_from and v_to;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Sales by Customer and 10. Purchases by Supplier (sales without a customer are
-- grouped as one "walk-in" row: party_id null).
-- ---------------------------------------------------------------------------
create function public.report_sales_by_customer(p_business_id uuid, p_from date, p_to date)
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
begin
  perform public.report_business(p_business_id, p_from, p_to);
  with by_party as (
    select customer_id as party_id, min(customer_name) as party, count(*) as n,
           sum(total) as total, sum(amount_paid) as paid, sum(balance) as balance
    from public.sales_overview
    where business_id = p_business_id and voided_at is null and sale_date between v_from and v_to
    group by customer_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'party_id', party_id, 'party', party, 'count', n,
           'total', total::numeric(14, 2)::text, 'paid', paid::numeric(14, 2)::text,
           'balance', balance::numeric(14, 2)::text)
         order by total desc, party nulls last), '[]'::jsonb),
         jsonb_build_object(
           'count', coalesce(sum(n), 0),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from by_party;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

create function public.report_purchases_by_supplier(p_business_id uuid, p_from date, p_to date)
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
begin
  perform public.report_business(p_business_id, p_from, p_to);
  with by_party as (
    select supplier_id as party_id, min(supplier_name) as party, count(*) as n,
           sum(total) as total, sum(amount_paid) as paid, sum(balance) as balance
    from public.purchases_overview
    where business_id = p_business_id and voided_at is null and purchase_date between v_from and v_to
    group by supplier_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'party_id', party_id, 'party', party, 'count', n,
           'total', total::numeric(14, 2)::text, 'paid', paid::numeric(14, 2)::text,
           'balance', balance::numeric(14, 2)::text)
         order by total desc, party nulls last), '[]'::jsonb),
         jsonb_build_object(
           'count', coalesce(sum(n), 0),
           'total', coalesce(sum(total), 0)::numeric(14, 2)::text,
           'paid', coalesce(sum(paid), 0)::numeric(14, 2)::text,
           'balance', coalesce(sum(balance), 0)::numeric(14, 2)::text)
  into v_rows, v_totals
  from by_party;
  return jsonb_build_object('from', p_from, 'to', p_to, 'rows', v_rows, 'totals', v_totals);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'report_business', 'report_sales', 'report_purchases', 'report_expenses',
    'report_profit_loss', 'report_cash_flow', 'report_payment_methods', 'report_to_collect',
    'report_to_pay', 'report_sales_by_customer', 'report_purchases_by_supplier'
  ] loop
    execute format('revoke all on function public.%I(uuid, date, date) from public, anon', f);
    execute format('grant execute on function public.%I(uuid, date, date) to authenticated', f);
  end loop;
end;
$$;
