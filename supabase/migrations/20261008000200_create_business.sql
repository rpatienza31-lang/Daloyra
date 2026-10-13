-- create_business: the only way a business is created (SPEC Section 6.3).
-- Inserts the business, the owner membership, reference counters and the trial
-- subscription in one transaction. Default expense categories are added here in
-- Phase 2, when that table exists.
--
-- The client generates p_business_id, so a retried request returns the same business
-- instead of creating a second one. One business per account in the MVP (SPEC 17.2).
--
-- Errors are raised with short message keys that the app maps to friendly text.

create function public.create_business(
  p_business_id uuid,
  p_name text,
  p_owner_name text default null,
  p_business_type text default null,
  p_address text default null,
  p_contact_number text default null,
  p_email text default null,
  p_currency_code text default 'PHP',
  p_starting_cash_balance text default '0',
  p_timezone text default 'Asia/Manila'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_trial_plan_id uuid;
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Manila');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users u where u.id = v_user_id and u.email_confirmed_at is not null
  ) then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  if p_business_id is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'p_business_id';
  end if;

  -- Serialise concurrent calls for the same user so the one-business rule holds.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  -- A retry of a call that already succeeded.
  if exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = v_user_id and m.role = 'owner'
  ) then
    return p_business_id;
  end if;

  if exists (select 1 from public.business_members m where m.user_id = v_user_id) then
    raise exception 'business_already_exists' using errcode = '23505';
  end if;

  if exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'p_business_id';
  end if;

  -- Amounts arrive as decimal strings so no floating point is ever involved.
  if p_starting_cash_balance is null
    or trim(p_starting_cash_balance) !~ '^\d{1,12}(\.\d{1,2})?$'
  then
    raise exception 'invalid_input' using errcode = '22023', detail = 'p_starting_cash_balance';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  select p.id into v_trial_plan_id from public.plans p where p.code = 'trial';
  if v_trial_plan_id is null then
    raise exception 'trial_plan_missing';
  end if;

  insert into public.businesses (
    id, name, owner_name, business_type, address, contact_number, email,
    currency_code, timezone, starting_cash_balance, starting_balance_date, created_by
  )
  values (
    p_business_id,
    trim(p_name),
    nullif(trim(p_owner_name), ''),
    nullif(trim(p_business_type), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_contact_number), ''),
    nullif(lower(trim(p_email)), ''),
    upper(coalesce(nullif(trim(p_currency_code), ''), 'PHP')),
    v_timezone,
    trim(p_starting_cash_balance)::numeric(14, 2),
    (now() at time zone v_timezone)::date,
    v_user_id
  );

  insert into public.business_members (business_id, user_id, role)
  values (p_business_id, v_user_id, 'owner');

  insert into public.business_counters (business_id, kind)
  values (p_business_id, 'sale'), (p_business_id, 'purchase');

  insert into public.subscriptions (business_id, plan_id, status, trial_ends_at, current_period_end)
  values (
    p_business_id,
    v_trial_plan_id,
    'trialing',
    now() + interval '14 days',
    now() + interval '14 days'
  );

  -- Fill in the profile name from onboarding if signup did not provide one.
  update public.profiles
  set full_name = nullif(trim(p_owner_name), '')
  where id = v_user_id and full_name is null;

  return p_business_id;
end;
$$;

revoke all on function public.create_business(
  uuid, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_business(
  uuid, text, text, text, text, text, text, text, text, text
) to authenticated;
