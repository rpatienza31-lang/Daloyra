-- Saves the business profile from Settings (owner only).
-- SECURITY INVOKER: the businesses RLS policy and column grants decide who may write.
-- The starting cash arrives as a decimal string so no floating point is involved, and
-- the starting date may not be in the future in the business's own timezone.

create function public.update_business_settings(
  p_business_id uuid,
  p_name text,
  p_owner_name text,
  p_business_type text,
  p_address text,
  p_contact_number text,
  p_email text,
  p_currency_code text,
  p_starting_cash_balance text,
  p_starting_balance_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_updated integer;
begin
  if p_starting_cash_balance is null
    or trim(p_starting_cash_balance) !~ '^\d{1,12}(\.\d{1,2})?$'
  then
    raise exception 'invalid_input' using errcode = '22023', detail = 'p_starting_cash_balance';
  end if;

  select b.timezone into v_timezone from public.businesses b where b.id = p_business_id;
  if v_timezone is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_starting_balance_date is null or p_starting_balance_date > (now() at time zone v_timezone)::date then
    raise exception 'date_in_future' using errcode = '22023';
  end if;

  update public.businesses
  set name = trim(p_name),
      owner_name = nullif(trim(p_owner_name), ''),
      business_type = nullif(trim(p_business_type), ''),
      address = nullif(trim(p_address), ''),
      contact_number = nullif(trim(p_contact_number), ''),
      email = nullif(lower(trim(p_email)), ''),
      currency_code = upper(trim(p_currency_code)),
      starting_cash_balance = trim(p_starting_cash_balance)::numeric(14, 2),
      starting_balance_date = p_starting_balance_date
  where id = p_business_id;
  get diagnostics v_updated = row_count;

  -- RLS hid the row: not the owner, or the business is suspended.
  if v_updated = 0 then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_business_settings(
  uuid, text, text, text, text, text, text, text, text, date
) from public, anon;
grant execute on function public.update_business_settings(
  uuid, text, text, text, text, text, text, text, text, date
) to authenticated;
