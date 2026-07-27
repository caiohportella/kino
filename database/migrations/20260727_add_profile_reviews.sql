-- Group public profile reviews with their author, title, and authoritative like data.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reviews_user_created_id
  ON public.reviews (user_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.get_profile_reviews(
  profile_username TEXT,
  page_limit INTEGER DEFAULT 6,
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title_id UUID,
  media_type TEXT,
  content TEXT,
  rating NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  like_count BIGINT,
  liked_by_viewer BOOLEAN,
  author_username TEXT,
  author_display_name TEXT,
  author_avatar_url TEXT,
  is_viewer_review BOOLEAN,
  tier INTEGER,
  total_count BIGINT,
  title_tmdb_id INTEGER,
  title_name TEXT,
  title_year INTEGER,
  title_poster_url TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH target_profile AS (
    SELECT up.id, up.username, up.display_name, up.avatar_url
    FROM public.user_profiles AS up
    WHERE lower(up.username) = lower(btrim(profile_username))
    LIMIT 1
  ),
  visible_reviews AS (
    SELECT
      r.id,
      r.user_id,
      r.title_id,
      r.media_type,
      r.content,
      r.rating,
      r.created_at,
      r.updated_at,
      COALESCE(likes.like_count, 0)::BIGINT AS like_count,
      COALESCE(likes.liked_by_viewer, false) AS liked_by_viewer,
      profile.username AS author_username,
      profile.display_name AS author_display_name,
      profile.avatar_url AS author_avatar_url,
      r.user_id = auth.uid() AS is_viewer_review,
      0 AS tier,
      t.tmdb_id AS title_tmdb_id,
      t.title AS title_name,
      t.release_year AS title_year,
      t.cover_image AS title_poster_url
    FROM target_profile AS profile
    JOIN public.reviews AS r ON r.user_id = profile.id
    JOIN public.titles AS t ON t.id = r.title_id
    LEFT JOIN LATERAL (
      SELECT
        count(*)::BIGINT AS like_count,
        COALESCE(bool_or(rl.user_id = auth.uid()), false) AS liked_by_viewer
      FROM public.review_likes AS rl
      WHERE rl.review_id = r.id
    ) AS likes ON true
  ),
  counted_reviews AS (
    SELECT vr.*, count(*) OVER ()::BIGINT AS total_count
    FROM visible_reviews AS vr
  )
  SELECT
    cr.id,
    cr.user_id,
    cr.title_id,
    cr.media_type,
    cr.content,
    cr.rating,
    cr.created_at,
    cr.updated_at,
    cr.like_count,
    cr.liked_by_viewer,
    cr.author_username,
    cr.author_display_name,
    cr.author_avatar_url,
    cr.is_viewer_review,
    cr.tier,
    cr.total_count,
    cr.title_tmdb_id,
    cr.title_name,
    cr.title_year,
    cr.title_poster_url
  FROM counted_reviews AS cr
  WHERE cursor_created_at IS NULL
    OR (cr.created_at, cr.id) < (cursor_created_at, cursor_id)
  ORDER BY cr.created_at DESC, cr.id DESC
  LIMIT least(greatest(COALESCE(page_limit, 6), 1), 50) + 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_reviews(TEXT, INTEGER, TIMESTAMPTZ, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_reviews(TEXT, INTEGER, TIMESTAMPTZ, UUID)
  TO anon, authenticated;

COMMIT;
