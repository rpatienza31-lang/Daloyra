-- Business logos (SPEC Section 6.3): a private bucket where every file lives under
-- `{business_id}/...`. Members can read their own business's files; only the owner of
-- an active business can add, replace or remove them. SVG is not allowed (it can carry
-- scripts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy logos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (select id::text from private.my_business_ids() as id)
  );

create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from private.my_writable_business_ids(array['owner']) as id
    )
  );

create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from private.my_writable_business_ids(array['owner']) as id
    )
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from private.my_writable_business_ids(array['owner']) as id
    )
  );

create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from private.my_writable_business_ids(array['owner']) as id
    )
  );
