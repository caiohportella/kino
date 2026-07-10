-- Count people, rather than individual rating rows, in title rating totals.
CREATE OR REPLACE FUNCTION get_title_rating_stats(p_title_id UUID)
RETURNS TABLE (
  average_rating NUMERIC,
  total_ratings BIGINT,
  star_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COALESCE(AVG(rating), 0) AS avg_rating,
      COUNT(DISTINCT user_id) AS total_count
    FROM title_ratings
    WHERE title_id = p_title_id
  ),
  breakdown AS (
    SELECT jsonb_object_agg(rating, count) AS stars
    FROM (
      SELECT rating, COUNT(*) AS count
      FROM title_ratings
      WHERE title_id = p_title_id
      GROUP BY rating
    ) ratings
  )
  SELECT
    ROUND(stats.avg_rating::NUMERIC, 1) AS average_rating,
    stats.total_count::BIGINT AS total_ratings,
    COALESCE(breakdown.stars, '{}'::jsonb) AS star_breakdown
  FROM stats, breakdown;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_series_rating_stats(p_title_id UUID)
RETURNS TABLE (
  average_rating NUMERIC,
  total_ratings BIGINT,
  star_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COALESCE(AVG(rating), 0) AS avg_rating,
      COUNT(DISTINCT user_id) AS total_count
    FROM episode_ratings
    WHERE title_id = p_title_id AND rating IS NOT NULL
  ),
  breakdown AS (
    SELECT jsonb_object_agg(rating, count) AS stars
    FROM (
      SELECT rating, COUNT(*) AS count
      FROM episode_ratings
      WHERE title_id = p_title_id AND rating IS NOT NULL
      GROUP BY rating
    ) ratings
  )
  SELECT
    ROUND(stats.avg_rating::NUMERIC, 1) AS average_rating,
    stats.total_count::BIGINT AS total_ratings,
    COALESCE(breakdown.stars, '{}'::jsonb) AS star_breakdown
  FROM stats, breakdown;
END;
$$ LANGUAGE plpgsql;
