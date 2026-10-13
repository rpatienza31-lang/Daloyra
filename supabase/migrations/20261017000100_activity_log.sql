-- Phase 7: the audit log viewer for owners (SPEC Section 8 and 14).
-- Reads public.audit_logs (owner-only by Row Level Security) and turns each entry into
-- something a person can read: what it was, who did it, and which fields changed, with
-- every value as exact text (amounts never pass through a float).

-- The display name of a member of the business, for the caller who owns that business.
-- Profiles are private to their user, so this narrow SECURITY DEFINER helper returns only
-- the name of someone in the same business, and only to its owner.
create function private.member_name(p_business_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), p.email)
  from public.profiles p
  join public.business_members m on m.user_id = p.id and m.business_id = p_business_id
  where p.id = p_user_id
    and p_business_id in (select private.my_business_ids(array['owner']));
$$;

revoke all on function private.member_name(uuid, uuid) from public;
grant execute on function private.member_name(uuid, uuid) to authenticated;

-- One value of a record, as readable text: names instead of ids, items as one line.
create function private.audit_value(p_business_id uuid, p_field text, p_value jsonb)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then null
    when p_field = 'customer_id' then
      (select c.name from public.customers c where c.business_id = p_business_id and c.id = (p_value #>> '{}')::uuid)
    when p_field = 'supplier_id' then
      (select s.name from public.suppliers s where s.business_id = p_business_id and s.id = (p_value #>> '{}')::uuid)
    when p_field = 'category_id' then
      (select c.name from public.expense_categories c where c.business_id = p_business_id and c.id = (p_value #>> '{}')::uuid)
    when p_field = 'items' then
      (select string_agg(
                concat_ws(' ', i ->> 'description', '×', trim_scale((i ->> 'quantity')::numeric)::text, '@',
                          coalesce(i ->> 'unit_price', i ->> 'unit_cost')),
                '; ' order by (i ->> 'position')::int)
       from jsonb_array_elements(p_value) i)
    else p_value #>> '{}'
  end;
$$;

revoke all on function private.audit_value(uuid, text, jsonb) from public;
grant execute on function private.audit_value(uuid, text, jsonb) to authenticated;

-- The activity list, newest first, a page at a time (p_before = created_at of the last row
-- already shown). p_table narrows it to one kind of record.
create function public.get_activity(
  p_business_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_table text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  table_name text,
  record_id uuid,
  parent_id uuid,
  action text,
  actor_name text,
  label text,
  amount text,
  reason text,
  changes jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id,
         a.created_at,
         a.table_name,
         a.record_id,
         coalesce(a.new_data ->> 'sale_id', a.new_data ->> 'purchase_id')::uuid,
         a.action,
         private.member_name(a.business_id, a.actor_id),
         case a.table_name
           when 'sales' then a.new_data ->> 'reference_no'
           when 'purchases' then a.new_data ->> 'reference_no'
           when 'customer_payments' then
             (select s.reference_no from public.sales s
              where s.business_id = a.business_id and s.id = (a.new_data ->> 'sale_id')::uuid)
           when 'supplier_payments' then
             (select p.reference_no from public.purchases p
              where p.business_id = a.business_id and p.id = (a.new_data ->> 'purchase_id')::uuid)
           when 'expenses' then coalesce(
             nullif(a.new_data ->> 'description', ''),
             private.audit_value(a.business_id, 'category_id', a.new_data -> 'category_id'))
           when 'cash_adjustments' then a.new_data ->> 'type'
           when 'businesses' then a.new_data ->> 'name'
         end,
         coalesce(a.new_data ->> 'total', a.new_data ->> 'amount'),
         a.new_data ->> 'void_reason',
         case when a.action = 'create' or a.old_data is null then '[]'::jsonb else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'field', k.key,
                    'old', private.audit_value(a.business_id, k.key, a.old_data -> k.key),
                    'new', private.audit_value(a.business_id, k.key, a.new_data -> k.key))
                  order by k.key)
           from jsonb_object_keys(a.new_data) as k(key)
           where k.key not in ('id', 'business_id', 'created_at', 'created_by', 'updated_at',
                               'updated_by', 'voided_at', 'voided_by', 'subtotal', 'sale_id',
                               'purchase_id', 'search_text')
             and (a.old_data -> k.key) is distinct from (a.new_data -> k.key)), '[]'::jsonb)
         end
  from public.audit_logs a
  where a.business_id = p_business_id
    and (p_before is null or a.created_at < p_before)
    and (p_table is null or a.table_name = p_table)
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_activity(uuid, timestamptz, integer, text) from public, anon;
grant execute on function public.get_activity(uuid, timestamptz, integer, text) to authenticated;
