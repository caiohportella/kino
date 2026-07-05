-- Function to get series rating statistics
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
      COALESCE(AVG(rating), 0) as avg_rating,
      COUNT(*) as total_count
    FROM episode_ratings
    WHERE title_id = p_title_id AND rating IS NOT NULL
  ),
  breakdown AS (
    SELECT
      jsonb_object_agg(rating, count) as stars
    FROM (
      SELECT
        rating,
        COUNT(*) as count
      FROM episode_ratings
      WHERE title_id = p_title_id AND rating IS NOT NULL
      GROUP BY rating
    ) ratings
  )
  SELECT
    ROUND(stats.avg_rating::NUMERIC, 1) as average_rating,
    stats.total_count::BIGINT as total_ratings,
    COALESCE(breakdown.stars, '{}'::jsonb) as star_breakdown
  FROM stats, breakdown;
END;
$$ LANGUAGE plpgsql;
