-- Phase 1: accounts and tenancy (SPEC Sections 6 and 7.1, 7.4).
--
-- Every public table has Row Level Security. Access to business data is granted only
-- through business_members, checked by helpers in the `private` schema, which is not
-- exposed through the Data API.

-- ---------------------------------------------------------------------------
-- Private schema and shared helpers
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
-- Policies run as the caller, so the API role needs to reach the helper functions.
grant usage on schema private to authenticated;

-- Keeps updated_at current on every table that has it.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger on signup
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- businesses: the tenant
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_name text check (owner_name is null or char_length(owner_name) <= 120),
  business_type text check (
    business_type is null
    or business_type in ('retail', 'food', 'online', 'services', 'other')
  ),
  address text check (address is null or char_length(address) <= 300),
  contact_number text check (contact_number is null or char_length(contact_number) <= 40),
  email text check (
    email is null
    or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  currency_code text not null default 'PHP' check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Manila',
  logo_path text check (logo_path is null or char_length(logo_path) <= 300),
  starting_cash_balance numeric(14, 2) not null default 0 check (starting_cash_balance >= 0),
  starting_balance_date date not null default ((now() at time zone 'Asia/Manila')::date),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

-- Timezone names cannot be checked by a CHECK constraint (the catalog is not immutable).
create function private.validate_business_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger businesses_validate_timezone
  before insert or update of timezone on public.businesses
  for each row execute function private.validate_business_timezone();

-- ---------------------------------------------------------------------------
-- business_members: the only thing that grants access to a business
-- ---------------------------------------------------------------------------

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (business_id, id)
);

-- Membership lookups by user drive every policy.
create index business_members_user_id_idx on public.business_members (user_id, business_id);

create trigger business_members_set_updated_at
  before update on public.business_members
  for each row execute function private.set_updated_at();

-- Businesses the caller belongs to, optionally limited to some roles. Used by read policies.
create function private.my_business_ids(allowed_roles text[] default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid())
    and (allowed_roles is null or m.role = any (allowed_roles));
$$;

-- Same, but only active (not suspended) businesses. Used by every write policy, so a
-- suspended business cannot change anything (decision D11).
create function private.my_writable_business_ids(allowed_roles text[] default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = (select auth.uid())
    and b.status = 'active'
    and (allowed_roles is null or m.role = any (allowed_roles));
$$;

revoke all on function private.my_business_ids(text[]) from public;
revoke all on function private.my_writable_business_ids(text[]) from public;
grant execute on function private.my_business_ids(text[]) to authenticated;
grant execute on function private.my_writable_business_ids(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- business_counters: reference number generation (S-0001, P-0001)
-- ---------------------------------------------------------------------------

create table public.business_counters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('sale', 'purchase')),
  next_value bigint not null default 1 check (next_value > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kind),
  unique (business_id, id)
);

create trigger business_counters_set_updated_at
  before update on public.business_counters
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Platform: plans, subscriptions, platform_admins, audit_logs
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('trial', 'basic', 'pro', 'premium')),
  name text not null,
  price_monthly numeric(14, 2) not null default 0 check (price_monthly >= 0),
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function private.set_updated_at();

-- The trial plan must exist in every environment because create_business uses it.
-- Paid plans are added when their prices are decided (Phase 8).
insert into public.plans (code, name, price_monthly, limits)
values ('trial', 'Free trial', 0, '{"members": 1, "exports": true}'::jsonb);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index subscriptions_plan_id_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- Platform admins (Phase 8). No client-side access at all.
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_admins_set_updated_at
  before update on public.platform_admins
  for each row execute function private.set_updated_at();

-- Append-only history of every create, edit and void. Written only by triggers.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('create', 'update', 'void')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_business_record_idx on public.audit_logs (business_id, table_name, record_id);

-- Generic audit trigger. Attach AFTER INSERT OR UPDATE to every audited table.
-- An update that sets voided_at is recorded as 'void'. Updates that change nothing
-- but updated_at are skipped.
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb := to_jsonb(new);
  v_action text;
  v_business_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  else
    v_old := to_jsonb(old);
    if (v_new - 'updated_at') = (v_old - 'updated_at') then
      return new;
    end if;
    v_action := case
      when v_old ->> 'voided_at' is null and v_new ->> 'voided_at' is not null then 'void'
      else 'update'
    end;
  end if;

  v_business_id := case
    when tg_table_name = 'businesses' then (v_new ->> 'id')::uuid
    else (v_new ->> 'business_id')::uuid
  end;

  insert into public.audit_logs (business_id, table_name, record_id, action, old_data, new_data, actor_id)
  values (v_business_id, tg_table_name, (v_new ->> 'id')::uuid, v_action, v_old, v_new, (select auth.uid()));

  return new;
end;
$$;

-- Business settings (including the starting cash balance) affect money figures.
create trigger businesses_audit
  after insert or update on public.businesses
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_counters enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_logs enable row level security;

-- Table privileges are granted explicitly and narrowly; RLS then filters rows.
revoke all on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.business_counters,
  public.plans,
  public.subscriptions,
  public.platform_admins,
  public.audit_logs
from anon, authenticated;

grant select on table
  public.profiles,
  public.businesses,
  public.business_members,
  public.business_counters,
  public.plans,
  public.subscriptions,
  public.audit_logs
to authenticated;

grant update (full_name) on public.profiles to authenticated;

-- id, status, created_by and timestamps are never writable from the client.
-- Businesses are inserted only by create_business().
grant update (
  name,
  owner_name,
  business_type,
  address,
  contact_number,
  email,
  currency_code,
  timezone,
  logo_path,
  starting_cash_balance,
  starting_balance_date
) on public.businesses to authenticated;

-- profiles: each user sees and edits only their own row.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- businesses: members read; only the owner of an active business edits settings.
create policy businesses_select on public.businesses
  for select to authenticated
  using (id in (select private.my_business_ids()));

create policy businesses_update on public.businesses
  for update to authenticated
  using (id in (select private.my_writable_business_ids(array['owner'])))
  with check (id in (select private.my_writable_business_ids(array['owner'])));

-- business_members: everyone sees their own membership; the owner sees the team.
-- Inserts and changes come later with staff invitations.
create policy business_members_select on public.business_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or business_id in (select private.my_business_ids(array['owner']))
  );

create policy business_counters_select on public.business_counters
  for select to authenticated
  using (business_id in (select private.my_business_ids()));

-- plans are not tenant data: any signed-in user may read active plans.
create policy plans_select on public.plans
  for select to authenticated
  using (is_active);

-- Subscription and audit log are owner-only (SPEC Section 8).
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (business_id in (select private.my_business_ids(array['owner'])));

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (business_id in (select private.my_business_ids(array['owner'])));

-- platform_admins: RLS on, no policies, no grants.
