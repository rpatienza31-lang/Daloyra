-- Profiles for users who signed up before the profile trigger existed.
insert into public.profiles (id, email, full_name)
select u.id, u.email, nullif(left(trim(u.raw_user_meta_data ->> 'full_name'), 120), '')
from auth.users u
on conflict (id) do nothing;
