-- Phase 3: sales, sale items and customer payments (SPEC Sections 3 and 7.3).
--
-- Money rules live here, once:
--   * line_total = round(quantity × unit_price, 2)           (generated column)
--   * subtotal   = Σ line_total                              (kept by trigger on sale_items)
--   * total      = subtotal − discount_amount                 (generated column)
--   * 0 ≤ discount ≤ subtotal; total ≥ amount paid; a balance needs a customer
--     (checked by private.validate_sale at the end of every write function, and again by
--     a deferred constraint trigger at commit)
--   * a payment never exceeds the remaining balance (row lock on the sale)
--   * payment status and balances are derived (sales_overview), never stored
--
-- The app has SELECT only on these tables. Every write goes through a SECURITY DEFINER
-- function below, which checks membership, role and suspension itself.

-- ---------------------------------------------------------------------------
-- Input helpers
-- ---------------------------------------------------------------------------

-- A money amount sent as a decimal string ("1500", "1500.5", "1500.50").
create function private.parse_amount(p_value text, p_field text, p_allow_zero boolean default false)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_amount numeric;
begin
  if p_value is null or trim(p_value) !~ '^\d{1,12}(\.\d{1,2})?$' then
    raise exception 'invalid_amount' using errcode = '22023', detail = p_field;
  end if;
  v_amount := trim(p_value)::numeric(14, 2);
  if v_amount = 0 and not p_allow_zero then
    raise exception 'invalid_amount' using errcode = '22023', detail = p_field;
  end if;
  return v_amount;
end;
$$;

-- A quantity sent as a decimal string with up to 3 decimals, greater than 0.
create function private.parse_quantity(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null
    or trim(p_value) !~ '^\d{1,9}(\.\d{1,3})?$'
    or trim(p_value)::numeric = 0
  then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  return trim(p_value)::numeric(12, 3);
end;
$$;

-- Raises unless the caller may write to the business with one of the given roles.
create function private.assert_writer(p_business_id uuid, p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_business_id is null
    or p_business_id not in (select private.my_writable_business_ids(p_roles))
  then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_writer(uuid, text[]) from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid,
  sale_date date not null,
  reference_no text not null check (char_length(reference_no) between 1 and 30),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  total numeric(14, 2) generated always as (subtotal - discount_amount) stored,
  due_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, reference_no),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  check (due_date is null or due_date >= sale_date),
  check ((voided_at is null) = (void_reason is null))
);

create index sales_business_date_idx on public.sales (business_id, sale_date);
create index sales_business_customer_idx on public.sales (business_id, customer_id);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  sale_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 200),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, sale_id) references public.sales (business_id, id) on delete cascade
);

create index sale_items_business_sale_idx on public.sale_items (business_id, sale_id, position);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  sale_id uuid not null,
  -- Copied from the sale by trigger (decision D9); never set by the app.
  customer_id uuid,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'cheque', 'other')),
  reference text check (reference is null or char_length(reference) <= 100),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, sale_id) references public.sales (business_id, id),
  foreign key (business_id, customer_id) references public.customers (business_id, id),
  check ((voided_at is null) = (void_reason is null))
);

create index customer_payments_business_date_idx on public.customer_payments (business_id, payment_date);
create index customer_payments_business_method_idx on public.customer_payments (business_id, method);
create index customer_payments_business_sale_idx on public.customer_payments (business_id, sale_id);

create trigger sales_set_updated_at before update on public.sales
  for each row execute function private.set_updated_at();
create trigger sales_stamp_actor before insert or update on public.sales
  for each row execute function private.stamp_actor();
create trigger sale_items_set_updated_at before update on public.sale_items
  for each row execute function private.set_updated_at();
create trigger customer_payments_set_updated_at before update on public.customer_payments
  for each row execute function private.set_updated_at();
create trigger customer_payments_stamp_actor before insert or update on public.customer_payments
  for each row execute function private.stamp_actor();

-- ---------------------------------------------------------------------------
-- Totals: subtotal always equals the sum of the item lines
-- ---------------------------------------------------------------------------

create function private.sync_sale_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid := case when tg_op = 'DELETE' then old.sale_id else new.sale_id end;
  v_business_id uuid := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
begin
  update public.sales s
  set subtotal = coalesce(
    (select sum(i.line_total) from public.sale_items i
     where i.business_id = v_business_id and i.sale_id = v_sale_id), 0)
  where s.business_id = v_business_id and s.id = v_sale_id;
  return null;
end;
$$;

create trigger sale_items_sync_subtotal
  after insert or update or delete on public.sale_items
  for each row execute function private.sync_sale_subtotal();

-- ---------------------------------------------------------------------------
-- Whole-document rules
-- ---------------------------------------------------------------------------

create function private.validate_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_items integer;
  v_items_total numeric;
  v_paid numeric;
  v_first_payment date;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found or v_sale.voided_at is not null then
    return;
  end if;

  select count(*), coalesce(sum(line_total), 0) into v_items, v_items_total
  from public.sale_items where business_id = v_sale.business_id and sale_id = v_sale.id;

  select coalesce(sum(amount), 0), min(payment_date) into v_paid, v_first_payment
  from public.customer_payments
  where business_id = v_sale.business_id and sale_id = v_sale.id and voided_at is null;

  if v_items = 0 then
    raise exception 'items_required' using errcode = '23514';
  end if;
  if v_sale.subtotal <> v_items_total then
    raise exception 'subtotal_mismatch' using errcode = '23514';
  end if;
  if v_sale.discount_amount > v_sale.subtotal then
    raise exception 'discount_too_large' using errcode = '23514';
  end if;
  if v_sale.total < v_paid then
    raise exception 'total_below_paid' using errcode = '23514';
  end if;
  -- Decision D4: money still owed must have someone to collect it from.
  if v_sale.total > v_paid and v_sale.customer_id is null then
    raise exception 'customer_required' using errcode = '23514';
  end if;
  -- Decision D5: a payment cannot be dated before its sale.
  if v_first_payment < v_sale.sale_date then
    raise exception 'payment_before_sale' using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.validate_sale(uuid) from public;

-- The same checks again at commit, whichever code path wrote the rows.
create function private.validate_sale_from_sales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_sale(new.id);
  return null;
end;
$$;

create function private.validate_sale_from_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_sale(case when tg_op = 'DELETE' then old.sale_id else new.sale_id end);
  return null;
end;
$$;

create constraint trigger sales_validate_at_commit
  after insert or update on public.sales
  deferrable initially deferred
  for each row execute function private.validate_sale_from_sales();

create constraint trigger sale_items_validate_at_commit
  after insert or update or delete on public.sale_items
  deferrable initially deferred
  for each row execute function private.validate_sale_from_child();

create constraint trigger customer_payments_validate_at_commit
  after insert or update on public.customer_payments
  deferrable initially deferred
  for each row execute function private.validate_sale_from_child();

-- ---------------------------------------------------------------------------
-- Payments: no overpayment, no edits (void and re-record instead), customer copied
-- ---------------------------------------------------------------------------

create function private.guard_customer_payment()
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

create trigger customer_payments_guard
  before insert or update on public.customer_payments
  for each row execute function private.guard_customer_payment();

-- When a sale's customer changes, its payments follow.
create function private.sync_payment_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_payments
  set customer_id = new.customer_id
  where business_id = new.business_id and sale_id = new.id;
  return null;
end;
$$;

create trigger sales_sync_payment_customer
  after update of customer_id on public.sales
  for each row
  when (old.customer_id is distinct from new.customer_id)
  execute function private.sync_payment_customer();

create trigger customer_payments_audit
  after insert or update on public.customer_payments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Audit: one entry per sale change, with a snapshot of its items (decision D12)
-- ---------------------------------------------------------------------------

create function private.audit_sale(p_sale_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_new jsonb;
  v_old jsonb;
begin
  select s.business_id,
         to_jsonb(s) || jsonb_build_object('items', coalesce((
           select jsonb_agg(to_jsonb(i) - 'business_id' - 'sale_id' order by i.position)
           from public.sale_items i where i.business_id = s.business_id and i.sale_id = s.id), '[]'::jsonb))
  into v_business_id, v_new
  from public.sales s where s.id = p_sale_id;

  select a.new_data into v_old
  from public.audit_logs a
  where a.business_id = v_business_id and a.table_name = 'sales' and a.record_id = p_sale_id
  order by a.created_at desc, a.id desc
  limit 1;

  -- A retried request that changed nothing adds no noise.
  if v_old is not null and (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
    return;
  end if;

  -- clock_timestamp() keeps entries in order even within one transaction.
  insert into public.audit_logs (business_id, table_name, record_id, action, old_data, new_data, actor_id, created_at)
  values (v_business_id, 'sales', p_sale_id, p_action, v_old, v_new, (select auth.uid()), clock_timestamp());
end;
$$;

revoke all on function private.audit_sale(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Reference numbers (S-0001), skipping numbers already used (decision D8)
-- ---------------------------------------------------------------------------

create function private.next_reference(p_business_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next bigint;
  v_ref text;
  v_prefix text;
begin
  if p_kind <> 'sale' then
    raise exception 'unsupported_counter' using errcode = '22023';
  end if;
  v_prefix := 'S-';

  select next_value into v_next from public.business_counters
  where business_id = p_business_id and kind = p_kind
  for update;
  if v_next is null then
    raise exception 'counter_missing';
  end if;

  loop
    v_ref := v_prefix || case when v_next < 10000 then lpad(v_next::text, 4, '0') else v_next::text end;
    exit when not exists (
      select 1 from public.sales where business_id = p_business_id and reference_no = v_ref
    );
    v_next := v_next + 1;
  end loop;

  update public.business_counters set next_value = v_next + 1
  where business_id = p_business_id and kind = p_kind;
  return v_ref;
end;
$$;

revoke all on function private.next_reference(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Items: shared by create_sale and update_sale
-- ---------------------------------------------------------------------------

create function private.insert_sale_items(p_business_id uuid, p_sale_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100
  then
    raise exception 'items_required' using errcode = '22023';
  end if;

  for v_item, v_position in
    select value, ordinality::integer - 1 from jsonb_array_elements(p_items) with ordinality
  loop
    if nullif(trim(v_item ->> 'description'), '') is null then
      raise exception 'description_required' using errcode = '22023';
    end if;
    insert into public.sale_items (business_id, sale_id, description, quantity, unit_price, position)
    values (
      p_business_id,
      p_sale_id,
      left(trim(v_item ->> 'description'), 200),
      private.parse_quantity(v_item ->> 'quantity'),
      private.parse_amount(v_item ->> 'unit_price', 'unit_price', true),
      v_position
    );
  end loop;
end;
$$;

revoke all on function private.insert_sale_items(uuid, uuid, jsonb) from public;

-- An active customer of this business, or null for Walk-in.
create function private.sale_customer(p_business_id uuid, p_value text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(trim(p_value), '')::uuid;
begin
  if v_id is null then
    return null;
  end if;
  if not exists (
    select 1 from public.customers
    where business_id = p_business_id and id = v_id and archived_at is null
  ) then
    raise exception 'customer_not_found' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

revoke all on function private.sale_customer(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Public write functions
-- ---------------------------------------------------------------------------

-- Creates a sale with its items and, optionally, its first payment, all or nothing.
-- p_sale: { id, customer_id?, sale_date, reference_no?, discount_amount?, due_date?, notes?,
--           items: [{ description, quantity, unit_price }],
--           payment?: { id, amount (decimal string, or "full"), method, payment_date?, reference? } }
-- Amounts and quantities are decimal strings.
create function public.create_sale(p_business_id uuid, p_sale jsonb)
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
    if v_amount > 0 then
      insert into public.customer_payments (id, business_id, sale_id, payment_date, amount, method, reference)
      values (
        coalesce(nullif(v_payment ->> 'id', '')::uuid, gen_random_uuid()),
        p_business_id,
        v_id,
        coalesce(nullif(v_payment ->> 'payment_date', '')::date, v_sale_date),
        v_amount,
        coalesce(nullif(v_payment ->> 'method', ''), 'cash'),
        nullif(left(trim(v_payment ->> 'reference'), 100), '')
      );
    end if;
  end if;

  perform private.validate_sale(v_id);
  perform private.audit_sale(v_id, 'create');
  return v_id;
end;
$$;

-- Edits a sale's details and replaces its items. Payments are not touched here.
-- p_sale: { id, customer_id?, sale_date, reference_no?, discount_amount?, due_date?, notes?, items }
create function public.update_sale(p_business_id uuid, p_sale jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_sale ->> 'id')::uuid;
  v_sale public.sales;
  v_reference text := nullif(trim(p_sale ->> 'reference_no'), '');
  v_sale_date date := (p_sale ->> 'sale_date')::date;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);

  select * into v_sale from public.sales
  where business_id = p_business_id and id = v_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sale.voided_at is not null then
    raise exception 'sale_voided' using errcode = '23514';
  end if;
  if v_sale_date is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_reference := coalesce(left(v_reference, 30), v_sale.reference_no);
  if v_reference <> v_sale.reference_no and exists (
    select 1 from public.sales where business_id = p_business_id and reference_no = v_reference
  ) then
    raise exception 'reference_taken' using errcode = '23505';
  end if;

  update public.sales
  set customer_id = private.sale_customer(p_business_id, p_sale ->> 'customer_id'),
      sale_date = v_sale_date,
      reference_no = v_reference,
      discount_amount = private.parse_amount(
        coalesce(nullif(trim(p_sale ->> 'discount_amount'), ''), '0'), 'discount_amount', true),
      due_date = nullif(trim(p_sale ->> 'due_date'), '')::date,
      notes = nullif(left(trim(p_sale ->> 'notes'), 1000), '')
  where business_id = p_business_id and id = v_id;

  delete from public.sale_items where business_id = p_business_id and sale_id = v_id;
  perform private.insert_sale_items(p_business_id, v_id, p_sale -> 'items');

  perform private.validate_sale(v_id);
  perform private.audit_sale(v_id, 'update');
end;
$$;

-- Cancels a sale and all its payments in one transaction (SPEC Section 3.6).
create function public.void_sale(p_business_id uuid, p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_reason text := nullif(left(trim(p_reason), 300), '');
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_sale from public.sales
  where business_id = p_business_id and id = p_sale_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sale.voided_at is not null then
    return;
  end if;

  update public.sales
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_sale_id;

  update public.customer_payments
  set voided_at = now(), voided_by = (select auth.uid()),
      void_reason = left('Sale cancelled: ' || v_reason, 300)
  where business_id = p_business_id and sale_id = p_sale_id and voided_at is null;

  perform private.audit_sale(p_sale_id, 'void');
end;
$$;

-- Records a payment against a sale. p_payment: { id, sale_id, amount, method,
-- payment_date, reference?, notes? }. Overpayment is refused by the payment trigger.
create function public.record_customer_payment(p_business_id uuid, p_payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_payment ->> 'id')::uuid;
  v_sale_id uuid := (p_payment ->> 'sale_id')::uuid;
  v_is_staff boolean;
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

  insert into public.customer_payments (id, business_id, sale_id, payment_date, amount, method, reference, notes)
  values (
    v_id,
    p_business_id,
    v_sale_id,
    (p_payment ->> 'payment_date')::date,
    private.parse_amount(p_payment ->> 'amount', 'amount'),
    coalesce(nullif(p_payment ->> 'method', ''), 'cash'),
    nullif(left(trim(p_payment ->> 'reference'), 100), ''),
    nullif(left(trim(p_payment ->> 'notes'), 500), '')
  );

  perform private.validate_sale(v_sale_id);
  return v_id;
end;
$$;

-- Cancels one payment (decision D5: payments are voided and re-recorded, never edited).
create function public.void_customer_payment(p_business_id uuid, p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_reason text := nullif(left(trim(p_reason), 300), '');
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select sale_id into v_sale_id from public.customer_payments
  where business_id = p_business_id and id = p_payment_id;
  if v_sale_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.sales where business_id = p_business_id and id = v_sale_id for update;

  update public.customer_payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_payment_id and voided_at is null;

  perform private.validate_sale(v_sale_id);
end;
$$;

revoke all on function public.create_sale(uuid, jsonb) from public, anon;
revoke all on function public.update_sale(uuid, jsonb) from public, anon;
revoke all on function public.void_sale(uuid, uuid, text) from public, anon;
revoke all on function public.record_customer_payment(uuid, jsonb) from public, anon;
revoke all on function public.void_customer_payment(uuid, uuid, text) from public, anon;
grant execute on function public.create_sale(uuid, jsonb) to authenticated;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, uuid, text) to authenticated;
grant execute on function public.record_customer_payment(uuid, jsonb) to authenticated;
grant execute on function public.void_customer_payment(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Currency is locked once any money record exists (decision D6)
-- ---------------------------------------------------------------------------

create function private.guard_currency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency_code is distinct from old.currency_code
    and exists (select 1 from public.sales where business_id = new.id)
  then
    raise exception 'currency_locked' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger businesses_guard_currency
  before update of currency_code on public.businesses
  for each row execute function private.guard_currency_change();

-- ---------------------------------------------------------------------------
-- Derived figures (SPEC Section 3.3)
-- ---------------------------------------------------------------------------

create view public.sales_overview
with (security_invoker = true)
as
select
  s.id,
  s.business_id,
  s.customer_id,
  c.name as customer_name,
  s.sale_date,
  s.reference_no,
  s.subtotal,
  s.discount_amount,
  s.total,
  s.due_date,
  s.notes,
  s.created_by,
  s.created_at,
  s.voided_at,
  s.void_reason,
  coalesce(p.paid, 0)::numeric(14, 2) as amount_paid,
  (case when s.voided_at is not null then 0 else s.total - coalesce(p.paid, 0) end)::numeric(14, 2) as balance,
  case
    when s.voided_at is not null then 'voided'
    when coalesce(p.paid, 0) >= s.total then 'paid'
    when coalesce(p.paid, 0) > 0 then 'partial'
    else 'unpaid'
  end as payment_status,
  case
    when s.voided_at is not null or coalesce(p.paid, 0) >= s.total then null
    when s.due_date is null then 'no_due_date'
    when s.due_date < t.today then 'overdue'
    when s.due_date <= t.today + 7 then 'due_soon'
    else 'not_due'
  end as due_status
from public.sales s
join public.businesses b on b.id = s.business_id
cross join lateral (select (now() at time zone b.timezone)::date as today) t
left join public.customers c on c.business_id = s.business_id and c.id = s.customer_id
left join lateral (
  select sum(cp.amount) as paid
  from public.customer_payments cp
  where cp.business_id = s.business_id and cp.sale_id = s.id and cp.voided_at is null
) p on true;

-- ---------------------------------------------------------------------------
-- Row Level Security: read only; staff see only what they recorded (decision D10)
-- ---------------------------------------------------------------------------

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.customer_payments enable row level security;

revoke all on table public.sales, public.sale_items, public.customer_payments, public.sales_overview
from anon, authenticated;
grant select on table public.sales, public.sale_items, public.customer_payments, public.sales_overview
to authenticated;

create policy sales_select on public.sales
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and created_by = (select auth.uid()))
  );

create policy sale_items_select on public.sale_items
  for select to authenticated
  using (exists (
    select 1 from public.sales s where s.business_id = sale_items.business_id and s.id = sale_items.sale_id
  ));

create policy customer_payments_select on public.customer_payments
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and (created_by = (select auth.uid())
             or exists (select 1 from public.sales s
                        where s.business_id = customer_payments.business_id
                          and s.id = customer_payments.sale_id)))
  );

-- Amount to Collect (SPEC 3.5), optionally for one customer. Returned as a decimal string.
-- SECURITY INVOKER: the caller sees only rows RLS allows.
create function public.get_amount_to_collect(p_business_id uuid, p_customer_id uuid default null)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(balance), 0)::numeric(14, 2)::text
  from public.sales_overview
  where business_id = p_business_id
    and voided_at is null
    and (p_customer_id is null or customer_id = p_customer_id);
$$;

revoke all on function public.get_amount_to_collect(uuid, uuid) from public, anon;
grant execute on function public.get_amount_to_collect(uuid, uuid) to authenticated;
