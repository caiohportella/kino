drop function if exists public.get_public_profile_og_data(text);

create function public.get_public_profile_og_data(profile_username text)
returns table (
  username text,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  movies_watched bigint,
  series_watched bigint,
  diary_entries bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.username,
    coalesce(p.display_name, p.username, 'Kino member') as display_name,
    p.avatar_url,
    p.banner_url,
    p.bio,
    (
      select count(distinct tr.title_id)
      from public.title_ratings tr
      join public.titles t on t.id = tr.title_id
      where tr.user_id = p.id and t.type = 'movie'
    ),
    (
      select count(distinct er.title_id)
      from public.episode_ratings er
      join public.titles t on t.id = er.title_id
      where er.user_id = p.id and t.type = 'tv'
    ),
    (select count(*) from public.watch_diary wd where wd.user_id = p.id)
  from public.user_profiles p
  where lower(p.username) = lower(profile_username)
  limit 1;
$$;

revoke all on function public.get_public_profile_og_data(text) from public;
grant execute on function public.get_public_profile_og_data(text) to anon, authenticated;
