-- Allow episode watch history to contain multiple watch/rewatch events.
ALTER TABLE episode_ratings
DROP CONSTRAINT IF EXISTS unique_user_episode_rating;

ALTER TABLE episode_ratings
DROP CONSTRAINT IF EXISTS episode_ratings_user_id_title_id_season_number_episode_numb_key;

ALTER TABLE episode_ratings
DROP CONSTRAINT IF EXISTS episode_ratings_user_episode_watch_event_key;

ALTER TABLE episode_ratings
ADD CONSTRAINT episode_ratings_user_episode_watch_event_key
UNIQUE (
  user_id,
  title_id,
  season_number,
  episode_number,
  watched_at
);

-- Watched episodes do not need to have a rating.
ALTER TABLE episode_ratings
ALTER COLUMN rating DROP NOT NULL;

-- Store the exact runtime of each watched episode.
ALTER TABLE episode_ratings
ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER;

ALTER TABLE episode_ratings
DROP CONSTRAINT IF EXISTS episode_ratings_runtime_minutes_check;

ALTER TABLE episode_ratings
ADD CONSTRAINT episode_ratings_runtime_minutes_check
CHECK (runtime_minutes IS NULL OR runtime_minutes > 0);