-- Add the authoritative published review count to public profile OG data.

BEGIN;

DROP FUNCTION IF EXISTS public.get_public_profile_og_data(TEXT);

CREATE FUNCTION public.get_public_profile_og_data(profile_username TEXT)
RETURNS TABLE (
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  movies_watched BIGINT,
  series_watched BIGINT,
  diary_entries BIGINT,
  review_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    p.username,
    coalesce(p.display_name, p.username, 'Kino member') AS display_name,
    p.avatar_url,
    p.banner_url,
    p.bio,
    (
      SELECT count(DISTINCT tr.title_id)
      FROM public.title_ratings AS tr
      JOIN public.titles AS t ON t.id = tr.title_id
      WHERE tr.user_id = p.id AND t.type = 'movie'
    ),
    (
      SELECT count(DISTINCT er.title_id)
      FROM public.episode_ratings AS er
      JOIN public.titles AS t ON t.id = er.title_id
      WHERE er.user_id = p.id AND t.type = 'tv'
    ),
    (SELECT count(*) FROM public.watch_diary AS wd WHERE wd.user_id = p.id),
    (SELECT count(*) FROM public.reviews AS r WHERE r.user_id = p.id)
  FROM public.user_profiles AS p
  WHERE lower(p.username) = lower(profile_username)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_og_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_og_data(TEXT) TO anon, authenticated;

COMMIT;
