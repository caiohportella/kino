create or replace function public.get_public_profile_og_data(profile_username text)
returns table (
  username text,
  display_name text,
  avatar_url text,
  bio text,
  movie_ratings bigint,
  episodes_watched bigint,
  diary_entries bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.username,
    coalesce(p.display_name, p.username, 'Kino member') as display_name,
    p.avatar_url,
    p.bio,
    (
      select count(*)
      from public.title_ratings tr
      where tr.user_id = p.id and tr.rating > 0
    ) as movie_ratings,
    (
      select count(*)
      from public.episode_ratings er
      where er.user_id = p.id
    ) as episodes_watched,
    (
      select count(*)
      from public.watch_diary wd
      where wd.user_id = p.id
    ) as diary_entries
  from public.user_profiles p
  where lower(p.username) = lower(profile_username)
  limit 1;
$$;

revoke all on function public.get_public_profile_og_data(text) from public;
grant execute on function public.get_public_profile_og_data(text) to anon, authenticated;
