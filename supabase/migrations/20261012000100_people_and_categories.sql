-- Phase 2: customers, suppliers and expense categories (SPEC Sections 7.2 and 8).
--
-- These are not money records, so the app writes them directly through the Data API;
-- RLS and column grants decide who may do what. They are archived, never deleted.
--   customers / suppliers: everyone in the business may view and add; owner and manager edit.
--   expense_categories:    everyone may view; owner and manager add and edit.

-- Stamps who created or last changed a row, so the client cannot claim someone else.
create function private.stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  end if;
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- customers and suppliers (same shape)
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (
    email is null
    or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  address text check (address is null or char_length(address) <= 300),
  notes text check (notes is null or char_length(notes) <= 1000),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index customers_business_name_idx on public.customers (business_id, lower(name));

create table public.suppliers (like public.customers including defaults including constraints);
alter table public.suppliers add primary key (id);
alter table public.suppliers add unique (business_id, id);
alter table public.suppliers
  add foreign key (business_id) references public.businesses (id) on delete cascade,
  add foreign key (created_by) references auth.users (id) on delete set null,
  add foreign key (updated_by) references auth.users (id) on delete set null;

create index suppliers_business_name_idx on public.suppliers (business_id, lower(name));

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();
create trigger customers_stamp_actor
  before insert or update on public.customers
  for each row execute function private.stamp_actor();

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function private.set_updated_at();
create trigger suppliers_stamp_actor
  before insert or update on public.suppliers
  for each row execute function private.stamp_actor();

-- ---------------------------------------------------------------------------
-- expense_categories
-- ---------------------------------------------------------------------------

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

-- One name per business, ignoring capitals ("Rent" and "rent" are the same category).
create unique index expense_categories_business_name_key
  on public.expense_categories (business_id, lower(name));

create trigger expense_categories_set_updated_at
  before update on public.expense_categories
  for each row execute function private.set_updated_at();
create trigger expense_categories_stamp_actor
  before insert or update on public.expense_categories
  for each row execute function private.stamp_actor();

-- Default categories (SPEC Section 7.2). Used by create_business and the backfill below.
create function private.seed_default_expense_categories(p_business_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.expense_categories (business_id, name, is_default)
  select p_business_id, d.name, true
  from unnest(array[
    'Rent', 'Utilities', 'Salaries/Wages', 'Transportation', 'Supplies',
    'Marketing', 'Internet', 'Maintenance', 'Miscellaneous'
  ]) as d(name)
  on conflict (business_id, lower(name)) do nothing;
$$;

revoke all on function private.seed_default_expense_categories(uuid) from public;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;

revoke all on table public.customers, public.suppliers, public.expense_categories
from anon, authenticated;

grant select on table public.customers, public.suppliers, public.expense_categories
to authenticated;

grant insert (id, business_id, name, phone, email, address, notes)
  on public.customers to authenticated;
grant update (name, phone, email, address, notes, archived_at)
  on public.customers to authenticated;
grant insert (id, business_id, name, phone, email, address, notes)
  on public.suppliers to authenticated;
grant update (name, phone, email, address, notes, archived_at)
  on public.suppliers to authenticated;

-- is_default is set only by the seed function.
grant insert (id, business_id, name) on public.expense_categories to authenticated;
grant update (name, archived_at) on public.expense_categories to authenticated;

create policy customers_select on public.customers
  for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy customers_insert on public.customers
  for insert to authenticated
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager', 'staff'])));
create policy customers_update on public.customers
  for update to authenticated
  using (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])))
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])));

create policy suppliers_select on public.suppliers
  for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager', 'staff'])));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])))
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])));

create policy expense_categories_select on public.expense_categories
  for select to authenticated
  using (business_id in (select private.my_business_ids()));
create policy expense_categories_insert on public.expense_categories
  for insert to authenticated
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])));
create policy expense_categories_update on public.expense_categories
  for update to authenticated
  using (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])))
  with check (business_id in (select private.my_writable_business_ids(array['owner', 'manager'])));

-- ---------------------------------------------------------------------------
-- New businesses get the default categories; existing ones are backfilled.
-- ---------------------------------------------------------------------------

create function private.after_business_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_default_expense_categories(new.id);
  return new;
end;
$$;

create trigger businesses_seed_categories
  after insert on public.businesses
  for each row execute function private.after_business_created();

select private.seed_default_expense_categories(b.id) from public.businesses b;
