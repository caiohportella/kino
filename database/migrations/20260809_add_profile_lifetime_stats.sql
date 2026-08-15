BEGIN;

ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS episode_runtime INTEGER;

CREATE OR REPLACE FUNCTION public.get_profile_lifetime_stats(p_profile_id UUID)
RETURNS TABLE (
  movies_watched BIGINT,
  episodes_watched BIGINT,
  ratings_made BIGINT,
  time_watched_minutes BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    (
      SELECT count(*)
      FROM public.watch_diary AS wd
      JOIN public.titles AS t ON t.id = wd.title_id
      WHERE wd.user_id = p_profile_id
        AND t.type = 'movie'
    ),
    (
      SELECT count(*)
      FROM public.episode_ratings AS er
      JOIN public.titles AS t ON t.id = er.title_id
      WHERE er.user_id = p_profile_id
        AND t.type = 'tv'
    ),
    (
      SELECT count(*)
      FROM public.title_ratings AS tr
      WHERE tr.user_id = p_profile_id
    )
    +
    (
      SELECT count(*)
      FROM public.episode_ratings AS er
      WHERE er.user_id = p_profile_id
        AND er.rating IS NOT NULL
    ),
    (
      COALESCE(
        (
          SELECT sum(t.runtime)
          FROM public.watch_diary AS wd
          JOIN public.titles AS t ON t.id = wd.title_id
          WHERE wd.user_id = p_profile_id
            AND t.type = 'movie'
            AND t.runtime IS NOT NULL
        ),
        0
      )
      +
      COALESCE(
        (
          SELECT sum(t.episode_runtime)
          FROM public.episode_ratings AS er
          JOIN public.titles AS t ON t.id = er.title_id
          WHERE er.user_id = p_profile_id
            AND t.type = 'tv'
            AND t.episode_runtime IS NOT NULL
        ),
        0
      )
    )
$$;

REVOKE ALL ON FUNCTION public.get_profile_lifetime_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_lifetime_stats(UUID) TO anon, authenticated;

COMMIT;
