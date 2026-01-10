-- Migration to support half-star ratings

-- Change rating column type from INTEGER to NUMERIC in title_ratings
ALTER TABLE title_ratings ALTER COLUMN rating TYPE NUMERIC(2, 1);

-- Change rating column type from INTEGER to NUMERIC in episode_ratings
ALTER TABLE episode_ratings ALTER COLUMN rating TYPE NUMERIC(2, 1);
