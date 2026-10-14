-- Phase 8: plans, trial expiry and the platform admin area (SPEC Sections 6.3, 7.4, 14).
--
-- Owner decisions (13–14 Oct): one paid plan, a one-time payment of ₱599 for lifetime use;
-- when the 14-day trial ends without payment the business is fully blocked until the admin
-- activates the plan. Admin functions are SECURITY DEFINER and check public.platform_admins,
-- so the app never needs the secret key. They show names, emails, plan, status and record
-- counts only, never amounts, customers or transactions, and every admin action is logged.

-- ---------------------------------------------------------------------------
-- Plans: a one-time "Lifetime" plan next to the free trial
-- ---------------------------------------------------------------------------
alter table public.plans drop constraint plans_code_check;
alter table public.plans
  add constraint plans_code_check check (code in ('trial', 'lifetime', 'basic', 'pro', 'premium')),
  add column billing text not null default 'monthly' check (billing in ('monthly', 'one_time')),
  add column price numeric(14, 2) not null default 0 check (price >= 0);

update public.plans set billing = 'one_time', price = 0 where code = 'trial';

insert into public.plans (code, name, price_monthly, price, billing, limits)
values ('lifetime', 'Daloyra Lifetime', 0, 599, 'one_time', '{"members": 1, "exports": true}'::jsonb);

-- ---------------------------------------------------------------------------
-- Access: a business can record only while it is active (not suspended) AND its trial is
-- still running or its plan is paid. Every write policy, write function and the logo
-- storage policies go through this helper, so an ended trial blocks all writes in the
-- database, not only in the app.
-- ---------------------------------------------------------------------------
create function private.subscription_allows_writes(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.business_id = p_business_id
      and (s.status = 'active'
           or (s.status = 'trialing' and s.trial_ends_at > now()))
  );
$$;

revoke all on function private.subscription_allows_writes(uuid) from public;

create or replace function private.my_writable_business_ids(allowed_roles text[] default null)
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
    and private.subscription_allows_writes(b.id)
    and (allowed_roles is null or m.role = any (allowed_roles));
$$;

-- The caller's access to their business, for the trial banner and the blocked screen.
-- access: 'trial' (running), 'trial_ended', 'paid' or 'suspended'.
create function public.get_my_access(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'access', case
      when b.status = 'suspended' then 'suspended'
      when s.status = 'active' then 'paid'
      when s.status = 'trialing' and s.trial_ends_at > now() then 'trial'
      else 'trial_ended'
    end,
    'plan_code', p.code,
    'plan_name', p.name,
    'trial_ends_at', s.trial_ends_at,
    'days_left', case when s.status = 'trialing'
      then greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int end,
    'price', (select l.price::text from public.plans l where l.code = 'lifetime'),
    'limits', p.limits
  )
  from public.businesses b
  join public.subscriptions s on s.business_id = b.id
  join public.plans p on p.id = s.plan_id
  where b.id = p_business_id
    and b.id in (select private.my_business_ids());
$$;

revoke all on function public.get_my_access(uuid) from public, anon;
grant execute on function public.get_my_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Platform admins
-- ---------------------------------------------------------------------------
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create function private.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_platform_admin() from public;

-- Every admin action, append-only. Not tenant data: no business_id column (the business
-- may later be deleted), no client access at all; read through admin_list_actions().
create table public.platform_admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  admin_email text not null,
  target_business_id uuid,
  target_business_name text not null,
  action text not null check (action in ('activate_plan', 'extend_trial', 'suspend', 'reactivate')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index platform_admin_actions_created_idx on public.platform_admin_actions (created_at desc);
create index platform_admin_actions_target_idx on public.platform_admin_actions (target_business_id);

alter table public.platform_admin_actions enable row level security;
revoke all on table public.platform_admin_actions from anon, authenticated;

create function private.log_admin_action(p_business_id uuid, p_action text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.platform_admin_actions
    (admin_user_id, admin_email, target_business_id, target_business_name, action, details)
  select (select auth.uid()),
         coalesce((select u.email from auth.users u where u.id = (select auth.uid())), ''),
         p_business_id,
         coalesce((select b.name from public.businesses b where b.id = p_business_id), ''),
         p_action,
         coalesce(p_details, '{}'::jsonb);
$$;

revoke all on function private.log_admin_action(uuid, text, jsonb) from public;

-- Every business with its owner, plan, access and record counts. No amounts.
create function public.admin_list_businesses()
returns table (
  id uuid,
  name text,
  owner_name text,
  owner_email text,
  business_type text,
  created_at timestamptz,
  status text,
  plan_code text,
  plan_name text,
  access text,
  trial_ends_at timestamptz,
  last_activity timestamptz,
  members bigint,
  sales bigint,
  purchases bigint,
  expenses bigint,
  customers bigint,
  suppliers bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  return query
  select b.id, b.name,
         coalesce(nullif(b.owner_name, ''), pr.full_name),
         u.email::text,
         b.business_type,
         b.created_at,
         b.status,
         p.code,
         p.name,
         case
           when b.status = 'suspended' then 'suspended'
           when s.status = 'active' then 'paid'
           when s.status = 'trialing' and s.trial_ends_at > now() then 'trial'
           else 'trial_ended'
         end,
         s.trial_ends_at,
         greatest(b.updated_at,
                  (select max(a.created_at) from public.audit_logs a where a.business_id = b.id)),
         (select count(*) from public.business_members m where m.business_id = b.id),
         (select count(*) from public.sales x where x.business_id = b.id and x.voided_at is null),
         (select count(*) from public.purchases x where x.business_id = b.id and x.voided_at is null),
         (select count(*) from public.expenses x where x.business_id = b.id and x.voided_at is null),
         (select count(*) from public.customers x where x.business_id = b.id),
         (select count(*) from public.suppliers x where x.business_id = b.id)
  from public.businesses b
  left join public.subscriptions s on s.business_id = b.id
  left join public.plans p on p.id = s.plan_id
  left join auth.users u on u.id = b.created_by
  left join public.profiles pr on pr.id = b.created_by
  order by b.created_at desc;
end;
$$;

create function public.admin_activate_plan(p_business_id uuid, p_plan_code text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
begin
  perform private.assert_platform_admin();
  select * into v_plan from public.plans where code = p_plan_code and is_active and code <> 'trial';
  if not found then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.subscriptions
  set plan_id = v_plan.id,
      status = 'active',
      current_period_end = case when v_plan.billing = 'one_time' then null
                                else now() + interval '1 month' end
  where business_id = p_business_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_admin_action(p_business_id, 'activate_plan',
    jsonb_build_object('plan', v_plan.code, 'price', v_plan.price::text,
                       'note', nullif(left(trim(p_note), 500), '')));
end;
$$;

create function public.admin_extend_trial(p_business_id uuid, p_days integer, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_end timestamptz;
begin
  perform private.assert_platform_admin();
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.subscriptions s
  set trial_ends_at = greatest(s.trial_ends_at, now()) + make_interval(days => p_days),
      current_period_end = greatest(s.trial_ends_at, now()) + make_interval(days => p_days)
  where s.business_id = p_business_id
    and s.status = 'trialing'
  returning s.trial_ends_at into v_new_end;
  if not found then
    -- Missing, or already on a paid plan.
    raise exception 'not_on_trial' using errcode = '22023';
  end if;
  perform private.log_admin_action(p_business_id, 'extend_trial',
    jsonb_build_object('days', p_days, 'trial_ends_at', v_new_end,
                       'note', nullif(left(trim(p_note), 500), '')));
end;
$$;

create function public.admin_set_business_status(p_business_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_status = 'suspended' and coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.businesses set status = p_status where id = p_business_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_admin_action(p_business_id,
    case when p_status = 'suspended' then 'suspend' else 'reactivate' end,
    jsonb_build_object('reason', nullif(left(trim(p_reason), 500), '')));
end;
$$;

create function public.admin_list_actions(p_limit integer default 100)
returns table (
  created_at timestamptz,
  admin_email text,
  business_id uuid,
  business_name text,
  action text,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  return query
  select a.created_at, a.admin_email, a.target_business_id, a.target_business_name, a.action, a.details
  from public.platform_admin_actions a
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_list_businesses()',
    'admin_activate_plan(uuid, text, text)',
    'admin_extend_trial(uuid, integer, text)',
    'admin_set_business_status(uuid, text, text)',
    'admin_list_actions(integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
