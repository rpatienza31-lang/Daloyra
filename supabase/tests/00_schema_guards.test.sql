-- Schema-wide guards (SPEC Sections 3.1, 6 and 15). These look at the catalog, so every
-- table added in later phases is checked automatically.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'Row Level Security is enabled on every public table'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'every public view uses security_invoker'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
       and (has_table_privilege('anon', c.oid, 'SELECT')
         or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE')) $$,
  'signed-out visitors (anon) have no privileges on any public table or view'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and (has_table_privilege('authenticated', c.oid, 'DELETE')
         or has_table_privilege('authenticated', c.oid, 'TRUNCATE')) $$,
  'signed-in users cannot delete from any public table (records are voided or archived)'
);

select is_empty(
  $$ select table_name::text || '.' || column_name::text from information_schema.columns
     where table_schema = 'public' and data_type in ('real', 'double precision') $$,
  'no public column stores money or quantities as floating point'
);

select is_empty(
  $$ select table_name::text from information_schema.columns
     where table_schema = 'public' and column_name = 'business_id' and is_nullable = 'YES'
       and table_name in (select table_name from information_schema.tables
                          where table_schema = 'public' and table_type = 'BASE TABLE') $$,
  'business_id is NOT NULL on every business-owned table'
);

-- unique (business_id, id) lets child rows use composite foreign keys.
select is_empty(
  $$ select c.relname::text
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'business_id' and not a.attisdropped
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (
         select 1 from pg_constraint k
         where k.conrelid = c.oid and k.contype in ('u', 'p')
           and (select array_agg(att.attname::text order by att.attname)
                from pg_attribute att
                where att.attrelid = c.oid and att.attnum = any (k.conkey)) = array['business_id', 'id']
       ) $$,
  'every business-owned table has unique (business_id, id)'
);

select is_empty(
  $$ select c.relname::text
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attname = 'business_id' and not a.attisdropped
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (
         select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum
       ) $$,
  'every business-owned table has an index led by business_id'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
                       where cfg in ('search_path=', 'search_path=""')) $$,
  'every security definer function pins an empty search_path'
);

select * from finish();
rollback;
