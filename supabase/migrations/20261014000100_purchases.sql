-- Phase 4 (part 1): purchases, purchase items and supplier payments — the mirror of sales
-- (SPEC Sections 3 and 7.3). Same rules: generated line totals and totals, subtotal kept by
-- trigger, whole-document checks at the end of every write function and at commit,
-- no overpayment (row lock), payments voided not edited, void cascades, derived status.
-- Generated from the sales migration and reviewed; helpers are shared.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid,
  purchase_date date not null,
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
  foreign key (business_id, supplier_id) references public.suppliers (business_id, id),
  check (due_date is null or due_date >= purchase_date),
  check ((voided_at is null) = (void_reason is null))
);

create index purchases_business_date_idx on public.purchases (business_id, purchase_date);
create index purchases_business_supplier_idx on public.purchases (business_id, supplier_id);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 200),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  line_total numeric(14, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, purchase_id) references public.purchases (business_id, id) on delete cascade
);

create index purchase_items_business_purchase_idx on public.purchase_items (business_id, purchase_id, position);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purchase_id uuid not null,
  -- Copied from the purchase by trigger (decision D9); never set by the app.
  supplier_id uuid,
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
  foreign key (business_id, purchase_id) references public.purchases (business_id, id),
  foreign key (business_id, supplier_id) references public.suppliers (business_id, id),
  check ((voided_at is null) = (void_reason is null))
);

create index supplier_payments_business_date_idx on public.supplier_payments (business_id, payment_date);
create index supplier_payments_business_method_idx on public.supplier_payments (business_id, method);
create index supplier_payments_business_purchase_idx on public.supplier_payments (business_id, purchase_id);

create trigger purchases_set_updated_at before update on public.purchases
  for each row execute function private.set_updated_at();
create trigger purchases_stamp_actor before insert or update on public.purchases
  for each row execute function private.stamp_actor();
create trigger purchase_items_set_updated_at before update on public.purchase_items
  for each row execute function private.set_updated_at();
create trigger supplier_payments_set_updated_at before update on public.supplier_payments
  for each row execute function private.set_updated_at();
create trigger supplier_payments_stamp_actor before insert or update on public.supplier_payments
  for each row execute function private.stamp_actor();

-- ---------------------------------------------------------------------------
-- Totals: subtotal always equals the sum of the item lines
-- ---------------------------------------------------------------------------

create function private.sync_purchase_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid := case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end;
  v_business_id uuid := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
begin
  update public.purchases s
  set subtotal = coalesce(
    (select sum(i.line_total) from public.purchase_items i
     where i.business_id = v_business_id and i.purchase_id = v_purchase_id), 0)
  where s.business_id = v_business_id and s.id = v_purchase_id;
  return null;
end;
$$;

create trigger purchase_items_sync_subtotal
  after insert or update or delete on public.purchase_items
  for each row execute function private.sync_purchase_subtotal();

-- ---------------------------------------------------------------------------
-- Whole-document rules
-- ---------------------------------------------------------------------------

create function private.validate_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_items integer;
  v_items_total numeric;
  v_paid numeric;
  v_first_payment date;
begin
  select * into v_purchase from public.purchases where id = p_purchase_id;
  if not found or v_purchase.voided_at is not null then
    return;
  end if;

  select count(*), coalesce(sum(line_total), 0) into v_items, v_items_total
  from public.purchase_items where business_id = v_purchase.business_id and purchase_id = v_purchase.id;

  select coalesce(sum(amount), 0), min(payment_date) into v_paid, v_first_payment
  from public.supplier_payments
  where business_id = v_purchase.business_id and purchase_id = v_purchase.id and voided_at is null;

  if v_items = 0 then
    raise exception 'items_required' using errcode = '23514';
  end if;
  if v_purchase.subtotal <> v_items_total then
    raise exception 'subtotal_mismatch' using errcode = '23514';
  end if;
  if v_purchase.discount_amount > v_purchase.subtotal then
    raise exception 'discount_too_large' using errcode = '23514';
  end if;
  if v_purchase.total < v_paid then
    raise exception 'total_below_paid' using errcode = '23514';
  end if;
  -- Decision D4: money still owed must have someone to pay it to.
  if v_purchase.total > v_paid and v_purchase.supplier_id is null then
    raise exception 'supplier_required' using errcode = '23514';
  end if;
  -- Decision D5: a payment cannot be dated before its purchase.
  if v_first_payment < v_purchase.purchase_date then
    raise exception 'payment_before_purchase' using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.validate_purchase(uuid) from public;

-- The same checks again at commit, whichever code path wrote the rows.
create function private.validate_purchase_from_purchases()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_purchase(new.id);
  return null;
end;
$$;

create function private.validate_purchase_from_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validate_purchase(case when tg_op = 'DELETE' then old.purchase_id else new.purchase_id end);
  return null;
end;
$$;

create constraint trigger purchases_validate_at_commit
  after insert or update on public.purchases
  deferrable initially deferred
  for each row execute function private.validate_purchase_from_purchases();

create constraint trigger purchase_items_validate_at_commit
  after insert or update or delete on public.purchase_items
  deferrable initially deferred
  for each row execute function private.validate_purchase_from_child();

create constraint trigger supplier_payments_validate_at_commit
  after insert or update on public.supplier_payments
  deferrable initially deferred
  for each row execute function private.validate_purchase_from_child();

-- ---------------------------------------------------------------------------
-- Payments: no overpayment, no edits (void and re-record instead), supplier copied
-- ---------------------------------------------------------------------------

create function private.guard_supplier_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_paid numeric;
begin
  -- Lock the purchase so two payments cannot both squeeze under the balance.
  select * into v_purchase from public.purchases
  where business_id = new.business_id and id = new.purchase_id
  for update;

  new.supplier_id := v_purchase.supplier_id;

  if tg_op = 'UPDATE' then
    if old.voided_at is not null and new.voided_at is null then
      raise exception 'payment_voided' using errcode = '23514';
    end if;
    if new.amount <> old.amount or new.payment_date <> old.payment_date
      or new.method <> old.method or new.purchase_id <> old.purchase_id
    then
      raise exception 'payment_immutable' using errcode = '23514';
    end if;
  end if;

  if new.voided_at is null then
    if v_purchase.voided_at is not null then
      raise exception 'purchase_voided' using errcode = '23514';
    end if;
    if new.payment_date < v_purchase.purchase_date then
      raise exception 'payment_before_purchase' using errcode = '23514';
    end if;
    select coalesce(sum(amount), 0) into v_paid
    from public.supplier_payments
    where business_id = new.business_id and purchase_id = new.purchase_id
      and voided_at is null and id <> new.id;
    if v_paid + new.amount > v_purchase.total then
      raise exception 'overpayment' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger supplier_payments_guard
  before insert or update on public.supplier_payments
  for each row execute function private.guard_supplier_payment();

-- When a purchase's supplier changes, its payments follow.
create function private.sync_payment_supplier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supplier_payments
  set supplier_id = new.supplier_id
  where business_id = new.business_id and purchase_id = new.id;
  return null;
end;
$$;

create trigger purchases_sync_payment_supplier
  after update of supplier_id on public.purchases
  for each row
  when (old.supplier_id is distinct from new.supplier_id)
  execute function private.sync_payment_supplier();

create trigger supplier_payments_audit
  after insert or update on public.supplier_payments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Audit: one entry per purchase change, with a snapshot of its items (decision D12)
-- ---------------------------------------------------------------------------

create function private.audit_purchase(p_purchase_id uuid, p_action text)
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
           select jsonb_agg(to_jsonb(i) - 'business_id' - 'purchase_id' order by i.position)
           from public.purchase_items i where i.business_id = s.business_id and i.purchase_id = s.id), '[]'::jsonb))
  into v_business_id, v_new
  from public.purchases s where s.id = p_purchase_id;

  select a.new_data into v_old
  from public.audit_logs a
  where a.business_id = v_business_id and a.table_name = 'purchases' and a.record_id = p_purchase_id
  order by a.created_at desc, a.id desc
  limit 1;

  -- A retried request that changed nothing adds no noise.
  if v_old is not null and (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
    return;
  end if;

  -- clock_timestamp() keeps entries in order even within one transaction.
  insert into public.audit_logs (business_id, table_name, record_id, action, old_data, new_data, actor_id, created_at)
  values (v_business_id, 'purchases', p_purchase_id, p_action, v_old, v_new, (select auth.uid()), clock_timestamp());
end;
$$;

revoke all on function private.audit_purchase(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Items: shared by create_purchase and update_purchase
-- ---------------------------------------------------------------------------

create function private.insert_purchase_items(p_business_id uuid, p_purchase_id uuid, p_items jsonb)
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
    insert into public.purchase_items (business_id, purchase_id, description, quantity, unit_cost, position)
    values (
      p_business_id,
      p_purchase_id,
      left(trim(v_item ->> 'description'), 200),
      private.parse_quantity(v_item ->> 'quantity'),
      private.parse_amount(v_item ->> 'unit_cost', 'unit_cost', true),
      v_position
    );
  end loop;
end;
$$;

revoke all on function private.insert_purchase_items(uuid, uuid, jsonb) from public;

-- An active supplier of this business, or null for no supplier.
create function private.purchase_supplier(p_business_id uuid, p_value text)
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
    select 1 from public.suppliers
    where business_id = p_business_id and id = v_id and archived_at is null
  ) then
    raise exception 'supplier_not_found' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

revoke all on function private.purchase_supplier(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Public write functions
-- ---------------------------------------------------------------------------

-- Creates a purchase with its items and, optionally, its first payment, all or nothing.
-- p_purchase: { id, supplier_id?, purchase_date, reference_no?, discount_amount?, due_date?, notes?,
--           items: [{ description, quantity, unit_cost }],
--           payment?: { id, amount (decimal string, or "full"), method, payment_date?, reference? } }
-- Amounts and quantities are decimal strings.
create function public.create_purchase(p_business_id uuid, p_purchase jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_purchase ->> 'id')::uuid;
  v_purchase_date date := (p_purchase ->> 'purchase_date')::date;
  v_reference text := nullif(trim(p_purchase ->> 'reference_no'), '');
  v_payment jsonb := p_purchase -> 'payment';
  v_amount numeric;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);

  if v_id is null or v_purchase_date is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- A retry of a request that already worked returns the same purchase.
  if exists (select 1 from public.purchases where id = v_id) then
    if exists (
      select 1 from public.purchases
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if v_reference is null then
    v_reference := private.next_reference(p_business_id, 'purchase');
  elsif exists (
    select 1 from public.purchases where business_id = p_business_id and reference_no = v_reference
  ) then
    raise exception 'reference_taken' using errcode = '23505';
  end if;

  insert into public.purchases (id, business_id, supplier_id, purchase_date, reference_no, discount_amount, due_date, notes)
  values (
    v_id,
    p_business_id,
    private.purchase_supplier(p_business_id, p_purchase ->> 'supplier_id'),
    v_purchase_date,
    left(v_reference, 30),
    private.parse_amount(coalesce(nullif(trim(p_purchase ->> 'discount_amount'), ''), '0'), 'discount_amount', true),
    nullif(trim(p_purchase ->> 'due_date'), '')::date,
    nullif(left(trim(p_purchase ->> 'notes'), 1000), '')
  );

  perform private.insert_purchase_items(p_business_id, v_id, p_purchase -> 'items');

  if v_payment is not null and jsonb_typeof(v_payment) = 'object' then
    -- "full" pays exactly the total the database just computed (nothing to pay if it is 0).
    if v_payment ->> 'amount' = 'full' then
      select total into v_amount from public.purchases where id = v_id;
    else
      v_amount := private.parse_amount(v_payment ->> 'amount', 'payment_amount');
    end if;
    if v_amount > 0 then
      insert into public.supplier_payments (id, business_id, purchase_id, payment_date, amount, method, reference)
      values (
        coalesce(nullif(v_payment ->> 'id', '')::uuid, gen_random_uuid()),
        p_business_id,
        v_id,
        coalesce(nullif(v_payment ->> 'payment_date', '')::date, v_purchase_date),
        v_amount,
        coalesce(nullif(v_payment ->> 'method', ''), 'cash'),
        nullif(left(trim(v_payment ->> 'reference'), 100), '')
      );
    end if;
  end if;

  perform private.validate_purchase(v_id);
  perform private.audit_purchase(v_id, 'create');
  return v_id;
end;
$$;

-- Edits a purchase's details and replaces its items. Payments are not touched here.
-- p_purchase: { id, supplier_id?, purchase_date, reference_no?, discount_amount?, due_date?, notes?, items }
create function public.update_purchase(p_business_id uuid, p_purchase jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_purchase ->> 'id')::uuid;
  v_purchase public.purchases;
  v_reference text := nullif(trim(p_purchase ->> 'reference_no'), '');
  v_purchase_date date := (p_purchase ->> 'purchase_date')::date;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);

  select * into v_purchase from public.purchases
  where business_id = p_business_id and id = v_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_purchase.voided_at is not null then
    raise exception 'purchase_voided' using errcode = '23514';
  end if;
  if v_purchase_date is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_reference := coalesce(left(v_reference, 30), v_purchase.reference_no);
  if v_reference <> v_purchase.reference_no and exists (
    select 1 from public.purchases where business_id = p_business_id and reference_no = v_reference
  ) then
    raise exception 'reference_taken' using errcode = '23505';
  end if;

  update public.purchases
  set supplier_id = private.purchase_supplier(p_business_id, p_purchase ->> 'supplier_id'),
      purchase_date = v_purchase_date,
      reference_no = v_reference,
      discount_amount = private.parse_amount(
        coalesce(nullif(trim(p_purchase ->> 'discount_amount'), ''), '0'), 'discount_amount', true),
      due_date = nullif(trim(p_purchase ->> 'due_date'), '')::date,
      notes = nullif(left(trim(p_purchase ->> 'notes'), 1000), '')
  where business_id = p_business_id and id = v_id;

  delete from public.purchase_items where business_id = p_business_id and purchase_id = v_id;
  perform private.insert_purchase_items(p_business_id, v_id, p_purchase -> 'items');

  perform private.validate_purchase(v_id);
  perform private.audit_purchase(v_id, 'update');
end;
$$;

-- Cancels a purchase and all its payments in one transaction (SPEC Section 3.6).
create function public.void_purchase(p_business_id uuid, p_purchase_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases;
  v_reason text := nullif(left(trim(p_reason), 300), '');
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into v_purchase from public.purchases
  where business_id = p_business_id and id = p_purchase_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_purchase.voided_at is not null then
    return;
  end if;

  update public.purchases
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_purchase_id;

  update public.supplier_payments
  set voided_at = now(), voided_by = (select auth.uid()),
      void_reason = left('Purchase cancelled: ' || v_reason, 300)
  where business_id = p_business_id and purchase_id = p_purchase_id and voided_at is null;

  perform private.audit_purchase(p_purchase_id, 'void');
end;
$$;

-- Records a payment against a purchase. p_payment: { id, purchase_id, amount, method,
-- payment_date, reference?, notes? }. Overpayment is refused by the payment trigger.
create function public.record_supplier_payment(p_business_id uuid, p_payment jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_payment ->> 'id')::uuid;
  v_purchase_id uuid := (p_payment ->> 'purchase_id')::uuid;
  v_is_staff boolean;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);
  if v_id is null or v_purchase_id is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.supplier_payments where id = v_id) then
    if exists (
      select 1 from public.supplier_payments
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- Staff may only pay purchases they recorded (decision D10).
  v_is_staff := p_business_id not in (select private.my_business_ids(array['owner', 'manager']));
  if not exists (
    select 1 from public.purchases
    where business_id = p_business_id and id = v_purchase_id
      and (not v_is_staff or created_by = (select auth.uid()))
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.supplier_payments (id, business_id, purchase_id, payment_date, amount, method, reference, notes)
  values (
    v_id,
    p_business_id,
    v_purchase_id,
    (p_payment ->> 'payment_date')::date,
    private.parse_amount(p_payment ->> 'amount', 'amount'),
    coalesce(nullif(p_payment ->> 'method', ''), 'cash'),
    nullif(left(trim(p_payment ->> 'reference'), 100), ''),
    nullif(left(trim(p_payment ->> 'notes'), 500), '')
  );

  perform private.validate_purchase(v_purchase_id);
  return v_id;
end;
$$;

-- Cancels one payment (decision D5: payments are voided and re-recorded, never edited).
create function public.void_supplier_payment(p_business_id uuid, p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_reason text := nullif(left(trim(p_reason), 300), '');
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select purchase_id into v_purchase_id from public.supplier_payments
  where business_id = p_business_id and id = p_payment_id;
  if v_purchase_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.purchases where business_id = p_business_id and id = v_purchase_id for update;

  update public.supplier_payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_payment_id and voided_at is null;

  perform private.validate_purchase(v_purchase_id);
end;
$$;

revoke all on function public.create_purchase(uuid, jsonb) from public, anon;
revoke all on function public.update_purchase(uuid, jsonb) from public, anon;
revoke all on function public.void_purchase(uuid, uuid, text) from public, anon;
revoke all on function public.record_supplier_payment(uuid, jsonb) from public, anon;
revoke all on function public.void_supplier_payment(uuid, uuid, text) from public, anon;
grant execute on function public.create_purchase(uuid, jsonb) to authenticated;
grant execute on function public.update_purchase(uuid, jsonb) to authenticated;
grant execute on function public.void_purchase(uuid, uuid, text) to authenticated;
grant execute on function public.record_supplier_payment(uuid, jsonb) to authenticated;
grant execute on function public.void_supplier_payment(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Derived figures (SPEC Section 3.3)
-- ---------------------------------------------------------------------------

create view public.purchases_overview
with (security_invoker = true)
as
select
  s.id,
  s.business_id,
  s.supplier_id,
  c.name as supplier_name,
  s.purchase_date,
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
from public.purchases s
join public.businesses b on b.id = s.business_id
cross join lateral (select (now() at time zone b.timezone)::date as today) t
left join public.suppliers c on c.business_id = s.business_id and c.id = s.supplier_id
left join lateral (
  select sum(cp.amount) as paid
  from public.supplier_payments cp
  where cp.business_id = s.business_id and cp.purchase_id = s.id and cp.voided_at is null
) p on true;

-- ---------------------------------------------------------------------------
-- Row Level Security: read only; staff see only what they recorded (decision D10)
-- ---------------------------------------------------------------------------

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_payments enable row level security;

revoke all on table public.purchases, public.purchase_items, public.supplier_payments, public.purchases_overview
from anon, authenticated;
grant select on table public.purchases, public.purchase_items, public.supplier_payments, public.purchases_overview
to authenticated;

create policy purchases_select on public.purchases
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and created_by = (select auth.uid()))
  );

create policy purchase_items_select on public.purchase_items
  for select to authenticated
  using (exists (
    select 1 from public.purchases s where s.business_id = purchase_items.business_id and s.id = purchase_items.purchase_id
  ));

create policy supplier_payments_select on public.supplier_payments
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and (created_by = (select auth.uid())
             or exists (select 1 from public.purchases s
                        where s.business_id = supplier_payments.business_id
                          and s.id = supplier_payments.purchase_id)))
  );

-- Amount to Pay (SPEC 3.5), optionally for one supplier. Returned as a decimal string.
-- SECURITY INVOKER: the caller sees only rows RLS allows.
create function public.get_amount_to_pay(p_business_id uuid, p_supplier_id uuid default null)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(balance), 0)::numeric(14, 2)::text
  from public.purchases_overview
  where business_id = p_business_id
    and voided_at is null
    and (p_supplier_id is null or supplier_id = p_supplier_id);
$$;

revoke all on function public.get_amount_to_pay(uuid, uuid) from public, anon;
grant execute on function public.get_amount_to_pay(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reference numbers now also for purchases (P-0001), still skipping used numbers (D8)
-- ---------------------------------------------------------------------------

create or replace function private.next_reference(p_business_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next bigint;
  v_ref text;
  v_prefix text;
  v_taken boolean;
begin
  if p_kind = 'sale' then
    v_prefix := 'S-';
  elsif p_kind = 'purchase' then
    v_prefix := 'P-';
  else
    raise exception 'unsupported_counter' using errcode = '22023';
  end if;

  select next_value into v_next from public.business_counters
  where business_id = p_business_id and kind = p_kind
  for update;
  if v_next is null then
    raise exception 'counter_missing';
  end if;

  loop
    v_ref := v_prefix || case when v_next < 10000 then lpad(v_next::text, 4, '0') else v_next::text end;
    if p_kind = 'sale' then
      select exists (select 1 from public.sales where business_id = p_business_id and reference_no = v_ref)
      into v_taken;
    else
      select exists (select 1 from public.purchases where business_id = p_business_id and reference_no = v_ref)
      into v_taken;
    end if;
    exit when not v_taken;
    v_next := v_next + 1;
  end loop;

  update public.business_counters set next_value = v_next + 1
  where business_id = p_business_id and kind = p_kind;
  return v_ref;
end;
$$;
