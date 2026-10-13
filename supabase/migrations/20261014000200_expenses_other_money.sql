-- Phase 4 (part 2): expenses and Other Money In / Out (SPEC Sections 2.1 #4, 3.4, 3.7, 7.3).
--
-- Expenses are always paid on the day they are recorded (SPEC 3.4) and count against
-- Profit. Other Money In / Out (cash_adjustments) changes cash but never Profit.
-- Like sales, the app has SELECT only; writes go through SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null,
  expense_date date not null,
  description text check (description is null or char_length(description) between 1 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'cheque', 'other')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id) references public.expense_categories (business_id, id),
  check ((voided_at is null) = (void_reason is null))
);

create index expenses_business_date_idx on public.expenses (business_id, expense_date);
create index expenses_business_method_idx on public.expenses (business_id, method);
create index expenses_business_category_idx on public.expenses (business_id, category_id);

-- "Other Money In / Out": owner put money in or took it out, loans, other.
create table public.cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  entry_date date not null,
  direction text not null check (direction in ('in', 'out')),
  type text not null check (type in ('owner_in', 'owner_out', 'loan_in', 'loan_out', 'other')),
  amount numeric(14, 2) not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'cheque', 'other')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  -- The type fixes the direction, except "other".
  check (
    type = 'other'
    or (type in ('owner_in', 'loan_in') and direction = 'in')
    or (type in ('owner_out', 'loan_out') and direction = 'out')
  ),
  check ((voided_at is null) = (void_reason is null))
);

create index cash_adjustments_business_date_idx on public.cash_adjustments (business_id, entry_date);
create index cash_adjustments_business_method_idx on public.cash_adjustments (business_id, method);

create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();
create trigger expenses_stamp_actor before insert or update on public.expenses
  for each row execute function private.stamp_actor();
create trigger expenses_audit after insert or update on public.expenses
  for each row execute function private.audit_row();

create trigger cash_adjustments_set_updated_at before update on public.cash_adjustments
  for each row execute function private.set_updated_at();
create trigger cash_adjustments_stamp_actor before insert or update on public.cash_adjustments
  for each row execute function private.stamp_actor();
create trigger cash_adjustments_audit after insert or update on public.cash_adjustments
  for each row execute function private.audit_row();

-- A voided record stays voided.
create function private.guard_unvoid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.voided_at is not null then
    raise exception 'record_voided' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_guard_unvoid before update on public.expenses
  for each row execute function private.guard_unvoid();
create trigger cash_adjustments_guard_unvoid before update on public.cash_adjustments
  for each row execute function private.guard_unvoid();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- An expense category of this business; must be active unless it is the current one.
create function private.expense_category(p_business_id uuid, p_value text, p_current uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(trim(p_value), '')::uuid;
begin
  if v_id is null or not exists (
    select 1 from public.expense_categories
    where business_id = p_business_id and id = v_id
      and (archived_at is null or v_id = p_current)
  ) then
    raise exception 'category_not_found' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

revoke all on function private.expense_category(uuid, text, uuid) from public;

-- A payment method from the shared list (the CHECK constraint is the final word).
create function private.payment_method(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(p_value), ''), 'cash');
$$;

-- ---------------------------------------------------------------------------
-- Expenses
-- p_expense: { id, category_id, expense_date, description?, amount, method, notes? }
-- ---------------------------------------------------------------------------

create function public.create_expense(p_business_id uuid, p_expense jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_expense ->> 'id')::uuid;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);
  if v_id is null or (p_expense ->> 'expense_date') is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.expenses where id = v_id) then
    if exists (
      select 1 from public.expenses
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  insert into public.expenses (id, business_id, category_id, expense_date, description, amount, method, notes)
  values (
    v_id,
    p_business_id,
    private.expense_category(p_business_id, p_expense ->> 'category_id'),
    (p_expense ->> 'expense_date')::date,
    nullif(left(trim(p_expense ->> 'description'), 200), ''),
    private.parse_amount(p_expense ->> 'amount', 'amount'),
    private.payment_method(p_expense ->> 'method'),
    nullif(left(trim(p_expense ->> 'notes'), 1000), '')
  );
  return v_id;
end;
$$;

create function public.update_expense(p_business_id uuid, p_expense jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_expense ->> 'id')::uuid;
  v_current public.expenses;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  select * into v_current from public.expenses
  where business_id = p_business_id and id = v_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current.voided_at is not null then
    raise exception 'record_voided' using errcode = '23514';
  end if;
  if (p_expense ->> 'expense_date') is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  update public.expenses
  set category_id = private.expense_category(p_business_id, p_expense ->> 'category_id', v_current.category_id),
      expense_date = (p_expense ->> 'expense_date')::date,
      description = nullif(left(trim(p_expense ->> 'description'), 200), ''),
      amount = private.parse_amount(p_expense ->> 'amount', 'amount'),
      method = private.payment_method(p_expense ->> 'method'),
      notes = nullif(left(trim(p_expense ->> 'notes'), 1000), '')
  where business_id = p_business_id and id = v_id;
end;
$$;

create function public.void_expense(p_business_id uuid, p_expense_id uuid, p_reason text)
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
  if not exists (select 1 from public.expenses where business_id = p_business_id and id = p_expense_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.expenses
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_expense_id and voided_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Other Money In / Out
-- p_entry: { id, entry_date, direction, type, amount, method, notes? }
-- ---------------------------------------------------------------------------

create function public.create_cash_adjustment(p_business_id uuid, p_entry jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_entry ->> 'id')::uuid;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager', 'staff']);
  if v_id is null or (p_entry ->> 'entry_date') is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if exists (select 1 from public.cash_adjustments where id = v_id) then
    if exists (
      select 1 from public.cash_adjustments
      where id = v_id and business_id = p_business_id and created_by = (select auth.uid())
    ) then
      return v_id;
    end if;
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  insert into public.cash_adjustments (id, business_id, entry_date, direction, type, amount, method, notes)
  values (
    v_id,
    p_business_id,
    (p_entry ->> 'entry_date')::date,
    p_entry ->> 'direction',
    p_entry ->> 'type',
    private.parse_amount(p_entry ->> 'amount', 'amount'),
    private.payment_method(p_entry ->> 'method'),
    nullif(left(trim(p_entry ->> 'notes'), 1000), '')
  );
  return v_id;
end;
$$;

create function public.update_cash_adjustment(p_business_id uuid, p_entry jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_entry ->> 'id')::uuid;
  v_voided timestamptz;
begin
  perform private.assert_writer(p_business_id, array['owner', 'manager']);
  select voided_at into v_voided from public.cash_adjustments
  where business_id = p_business_id and id = v_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_voided is not null then
    raise exception 'record_voided' using errcode = '23514';
  end if;
  if (p_entry ->> 'entry_date') is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  update public.cash_adjustments
  set entry_date = (p_entry ->> 'entry_date')::date,
      direction = p_entry ->> 'direction',
      type = p_entry ->> 'type',
      amount = private.parse_amount(p_entry ->> 'amount', 'amount'),
      method = private.payment_method(p_entry ->> 'method'),
      notes = nullif(left(trim(p_entry ->> 'notes'), 1000), '')
  where business_id = p_business_id and id = v_id;
end;
$$;

create function public.void_cash_adjustment(p_business_id uuid, p_entry_id uuid, p_reason text)
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
  if not exists (select 1 from public.cash_adjustments where business_id = p_business_id and id = p_entry_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.cash_adjustments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where business_id = p_business_id and id = p_entry_id and voided_at is null;
end;
$$;

revoke all on function public.create_expense(uuid, jsonb) from public, anon;
revoke all on function public.update_expense(uuid, jsonb) from public, anon;
revoke all on function public.void_expense(uuid, uuid, text) from public, anon;
revoke all on function public.create_cash_adjustment(uuid, jsonb) from public, anon;
revoke all on function public.update_cash_adjustment(uuid, jsonb) from public, anon;
revoke all on function public.void_cash_adjustment(uuid, uuid, text) from public, anon;
grant execute on function public.create_expense(uuid, jsonb) to authenticated;
grant execute on function public.update_expense(uuid, jsonb) to authenticated;
grant execute on function public.void_expense(uuid, uuid, text) to authenticated;
grant execute on function public.create_cash_adjustment(uuid, jsonb) to authenticated;
grant execute on function public.update_cash_adjustment(uuid, jsonb) to authenticated;
grant execute on function public.void_cash_adjustment(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Currency is locked once any money record exists (decision D6), now for every kind
-- ---------------------------------------------------------------------------

create or replace function private.guard_currency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency_code is distinct from old.currency_code and (
    exists (select 1 from public.sales where business_id = new.id)
    or exists (select 1 from public.purchases where business_id = new.id)
    or exists (select 1 from public.expenses where business_id = new.id)
    or exists (select 1 from public.cash_adjustments where business_id = new.id)
  ) then
    raise exception 'currency_locked' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- For the Settings page: true once any money record exists.
create function public.has_money_records(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_business_id in (select private.my_business_ids())
    and (
      exists (select 1 from public.sales where business_id = p_business_id)
      or exists (select 1 from public.purchases where business_id = p_business_id)
      or exists (select 1 from public.expenses where business_id = p_business_id)
      or exists (select 1 from public.cash_adjustments where business_id = p_business_id)
    );
$$;

revoke all on function public.has_money_records(uuid) from public, anon;
grant execute on function public.has_money_records(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: read only; staff see only what they recorded (decision D10)
-- ---------------------------------------------------------------------------

alter table public.expenses enable row level security;
alter table public.cash_adjustments enable row level security;

revoke all on table public.expenses, public.cash_adjustments from anon, authenticated;
grant select on table public.expenses, public.cash_adjustments to authenticated;

create policy expenses_select on public.expenses
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and created_by = (select auth.uid()))
  );

create policy cash_adjustments_select on public.cash_adjustments
  for select to authenticated
  using (
    business_id in (select private.my_business_ids(array['owner', 'manager']))
    or (business_id in (select private.my_business_ids(array['staff']))
        and created_by = (select auth.uid()))
  );
