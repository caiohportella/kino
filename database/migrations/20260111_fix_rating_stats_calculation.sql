-- Fix logic for calculating title rating statistics
-- Previous logic was averaging the rating keys instead of values and counting unique ratings instead of total votes

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
      COALESCE(AVG(rating), 0) as avg_rating,
      COUNT(*) as total_count
    FROM title_ratings
    WHERE title_id = p_title_id
  ),
  breakdown AS (
    SELECT 
      jsonb_object_agg(rating, count) as stars
    FROM (
      SELECT 
        rating,
        COUNT(*) as count
      FROM title_ratings
      WHERE title_id = p_title_id
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
