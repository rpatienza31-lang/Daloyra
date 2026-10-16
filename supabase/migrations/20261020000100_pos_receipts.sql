-- Phase 10: POS sale screen and receipts (decisions D66, D67).
--
-- A payment can record the cash the customer handed over (amount_received); the change is a
-- generated column, so it is computed by the database and the receipt can show it later.
-- amount_received is optional, never less than the payment, and cannot be changed afterwards
-- (payments are voided and re-recorded, D5). Nothing else about money changes.

alter table public.customer_payments
  add column amount_received numeric(14, 2),
  add column change_amount numeric(14, 2) generated always as (amount_received - amount) stored,
  add constraint customer_payments_received_check
    check (amount_received is null or amount_received >= amount);

-- The cash handed over, as a decimal string; null when not given. Never less than the amount.
create function private.amount_received(p_value text, p_amount numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_received numeric;
begin
  if nullif(trim(p_value), '') is null then
    return null;
  end if;
  v_received := private.parse_amount(p_value, 'amount_received');
  if v_received < p_amount then
    raise exception 'received_too_little' using errcode = '23514';
  end if;
  return v_received;
end;
$$;

revoke all on function private.amount_received(text, numeric) from public;

create or replace function private.guard_customer_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_paid numeric;
begin
  -- Lock the sale so two payments cannot both squeeze under the balance.
  select * into v_sale from public.sales
  where business_id = new.business_id and id = new.sale_id
  for update;

  new.customer_id := v_sale.customer_id;

  if tg_op = 'UPDATE' then
    if old.voided_at is not null and new.voided_at is null then
      raise exception 'payment_voided' using errcode = '23514';
    end if;
    if new.amount <> old.amount or new.payment_date <> old.payment_date
      or new.method <> old.method or new.sale_id <> old.sale_id
      or new.amount_received is distinct from old.amount_received
    then
      raise exception 'payment_immutable' using errcode = '23514';
    end if;
  end if;

  if new.voided_at is null then
    if v_sale.voided_at is not null then
      raise exception 'sale_voided' using errcode = '23514';
    end if;
    if new.payment_date < v_sale.sale_date then
      raise exception 'payment_before_sale' using errcode = '23514';
    end if;
    select coalesce(sum(amount), 0) into v_paid
    from public.customer_payments
    where business_id = new.business_id and sale_id = new.sale_id
      and voided_at is null and id <> new.id;
    if v_paid + new.amount > v_sale.total then
      raise exception 'overpayment' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.create_sale(p_business_id uuid, p_sale jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_sale ->> 'id')::uuid;
  v_sale_date date := (p_sale ->> 'sale_date')::date;
  v_reference text := nullif(trim(p_sale ->> 'reference_no'), '');
  v_payment jsonb := p_sale -> 'payment';
  v_amount numeric;
  v_received numeric;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);

  if v_id is null or v_sale_date is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- A retry of a request that already worked returns the same sale.
  if exists (select 1 from public.sales where id = v_id) then
    if exists (
      select 1 from public.sales
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if v_reference is null then
    v_reference := private.next_reference(p_business_id, 'sale');
  elsif exists (
    select 1 from public.sales where business_id = p_business_id and reference_no = v_reference
  ) then
    raise exception 'reference_taken' using errcode = '23505';
  end if;

  insert into public.sales (id, business_id, customer_id, sale_date, reference_no, discount_amount, due_date, notes)
  values (
    v_id,
    p_business_id,
    private.sale_customer(p_business_id, p_sale ->> 'customer_id'),
    v_sale_date,
    left(v_reference, 30),
    private.parse_amount(coalesce(nullif(trim(p_sale ->> 'discount_amount'), ''), '0'), 'discount_amount', true),
    nullif(trim(p_sale ->> 'due_date'), '')::date,
    nullif(left(trim(p_sale ->> 'notes'), 1000), '')
  );

  perform private.insert_sale_items(p_business_id, v_id, p_sale -> 'items');

  if v_payment is not null and jsonb_typeof(v_payment) = 'object' then
    -- "full" pays exactly the total the database just computed (nothing to pay if it is 0).
    if v_payment ->> 'amount' = 'full' then
      select total into v_amount from public.sales where id = v_id;
    else
      v_amount := private.parse_amount(v_payment ->> 'amount', 'payment_amount');
    end if;
    v_received := private.amount_received(v_payment ->> 'amount_received', v_amount);
    if v_amount > 0 then
      insert into public.customer_payments
        (id, business_id, sale_id, payment_date, amount, method, reference, amount_received)
      values (
        coalesce(nullif(v_payment ->> 'id', '')::uuid, gen_random_uuid()),
        p_business_id,
        v_id,
        coalesce(nullif(v_payment ->> 'payment_date', '')::date, v_sale_date),
        v_amount,
        coalesce(nullif(v_payment ->> 'method', ''), 'cash'),
        nullif(left(trim(v_payment ->> 'reference'), 100), ''),
        v_received
      );
    end if;
  end if;

  perform private.validate_sale(v_id);
  perform private.audit_sale(v_id, 'create');
  return v_id;
end;
$$;

create or replace function public.record_customer_payment(p_business_id uuid, p_payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_payment ->> 'id')::uuid;
  v_sale_id uuid := (p_payment ->> 'sale_id')::uuid;
  v_is_staff boolean;
  v_amount numeric;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);
  if v_id is null or v_sale_id is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.customer_payments where id = v_id) then
    if exists (
      select 1 from public.customer_payments
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- Staff may only collect on sales they recorded (decision D10).
  v_is_staff := p_business_id not in (select private.my_business_ids(array['owner', 'manager']));
  if not exists (
    select 1 from public.sales
    where business_id = p_business_id and id = v_sale_id
      and (not v_is_staff or created_by = (select auth.uid()))
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_amount := private.parse_amount(p_payment ->> 'amount', 'amount');
  insert into public.customer_payments
    (id, business_id, sale_id, payment_date, amount, method, reference, notes, amount_received)
  values (
    v_id,
    p_business_id,
    v_sale_id,
    (p_payment ->> 'payment_date')::date,
    v_amount,
    coalesce(nullif(p_payment ->> 'method', ''), 'cash'),
    nullif(left(trim(p_payment ->> 'reference'), 100), ''),
    nullif(left(trim(p_payment ->> 'notes'), 500), ''),
    private.amount_received(p_payment ->> 'amount_received', v_amount)
  );

  perform private.validate_sale(v_sale_id);
  return v_id;
end;
$$;
