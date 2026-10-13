-- Phase 7 fix: activity paging must not skip entries saved in the same instant.
-- 1. Audit entries from the generic trigger get their exact time (as sales and purchases
--    already do), so a transaction that writes several entries keeps them in order.
-- 2. get_activity pages by (created_at, id), so ties at a page boundary are never lost.

create or replace function private.audit_row()
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

  -- clock_timestamp(): entries written in one transaction keep their real order.
  insert into public.audit_logs (business_id, table_name, record_id, action, old_data, new_data, actor_id, created_at)
  values (v_business_id, tg_table_name, (v_new ->> 'id')::uuid, v_action, v_old, v_new, (select auth.uid()), clock_timestamp());

  return new;
end;
$$;

drop function public.get_activity(uuid, timestamptz, integer, text);

-- The activity list, newest first, a page at a time: p_before / p_before_id are the
-- created_at and id of the last row already shown (entries saved in the same instant are
-- told apart by id, so none is skipped). p_table narrows it to one kind of record.
create function public.get_activity(
  p_business_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_table text default null,
  p_before_id uuid default null
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
    and (p_before is null
         or a.created_at < p_before
         or (a.created_at = p_before and p_before_id is not null and a.id < p_before_id))
    and (p_table is null or a.table_name = p_table)
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_activity(uuid, timestamptz, integer, text, uuid) from public, anon;
grant execute on function public.get_activity(uuid, timestamptz, integer, text, uuid) to authenticated;
