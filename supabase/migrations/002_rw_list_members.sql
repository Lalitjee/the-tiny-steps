-- The Tiny Steps: list the members of a family with their name and email.
-- Needed because auth.users is not readable from the browser. Run once in the Supabase SQL Editor.
-- Members of the family can call it; everyone else gets no rows.

create or replace function public.rw_list_members(p_family uuid)
returns table (user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public
as $$
  select m.user_id,
         u.email::text,
         nullif(u.raw_user_meta_data ->> 'full_name', '') as full_name,
         m.role
  from public.rw_family_members m
  join auth.users u on u.id = m.user_id
  where m.family_id = p_family
    and public.rw_is_member(p_family)
  order by m.role, m.created_at
$$;

revoke all on function public.rw_list_members(uuid) from public, anon;
grant execute on function public.rw_list_members(uuid) to authenticated;
