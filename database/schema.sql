-- Kino Database Schema for Supabase
-- This file documents the database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
-- Additional user profile information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Titles table - stores movie and TV show metadata
CREATE TABLE IF NOT EXISTS titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tmdb_id INTEGER UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  synopsis TEXT,
  cover_image TEXT,
  backdrop_image TEXT,
  release_year INTEGER,
  genres JSONB DEFAULT '[]'::jsonb,
  cast JSONB DEFAULT '[]'::jsonb,
  director JSONB,
  runtime INTEGER, -- For movies
  total_seasons INTEGER, -- For TV shows
  tmdb_data JSONB, -- Store full TMDb response for caching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on tmdb_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_titles_tmdb_id ON titles(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_titles_type ON titles(type);

-- User ratings for movies
CREATE TABLE IF NOT EXISTS title_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  watch_type TEXT NOT NULL CHECK (watch_type IN ('first-time', 'rewatch')),
  watched_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id, watched_at)
);

CREATE INDEX IF NOT EXISTS idx_title_ratings_user_id ON title_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_title_ratings_title_id ON title_ratings(title_id);

-- Episode ratings for TV shows
CREATE TABLE IF NOT EXISTS episode_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  watch_type TEXT NOT NULL CHECK (watch_type IN ('first-time', 'rewatch')),
  watched_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id, season_number, episode_number, watched_at)
);

CREATE INDEX IF NOT EXISTS idx_episode_ratings_user_id ON episode_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_ratings_title_id ON episode_ratings(title_id);

-- Watch diary entries
CREATE TABLE IF NOT EXISTS watch_diary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ NOT NULL,
  watch_type TEXT NOT NULL CHECK (watch_type IN ('first-time', 'rewatch')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_diary_user_id ON watch_diary(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_diary_watched_at ON watch_diary(watched_at);

-- Watchlists
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  share_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);

-- Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, title_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_title_id ON watchlist_items(title_id);

-- Watchlist collaborators (for shared watchlists)
CREATE TABLE IF NOT EXISTS watchlist_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_collaborators_watchlist_id ON watchlist_collaborators(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_collaborators_user_id ON watchlist_collaborators(user_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_collaborators ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can read all profiles, update their own
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Titles: Everyone can read, only authenticated users can insert/update
CREATE POLICY "Everyone can view titles" ON titles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert titles" ON titles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update titles" ON titles FOR UPDATE USING (auth.role() = 'authenticated');

-- Title ratings: Users can read all, manage their own
CREATE POLICY "Users can view all title ratings" ON title_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own ratings" ON title_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON title_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON title_ratings FOR DELETE USING (auth.uid() = user_id);

-- Episode ratings: Users can read all, manage their own
CREATE POLICY "Users can view all episode ratings" ON episode_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own episode ratings" ON episode_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own episode ratings" ON episode_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own episode ratings" ON episode_ratings FOR DELETE USING (auth.uid() = user_id);

-- Watch diary: Users can read all, manage their own
CREATE POLICY "Users can view all diary entries" ON watch_diary FOR SELECT USING (true);
CREATE POLICY "Users can insert own diary entries" ON watch_diary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diary entries" ON watch_diary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own diary entries" ON watch_diary FOR DELETE USING (auth.uid() = user_id);

-- Function to safely get collaborated watchlists (bypassing RLS)
CREATE OR REPLACE FUNCTION get_user_collaborated_watchlist_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT watchlist_id 
  FROM watchlist_collaborators 
  WHERE user_id = p_user_id;
$$;

-- Watchlists: Users can read public/shared or their own, manage their own
CREATE POLICY "Users can view own and shared watchlists" ON watchlists FOR SELECT 
  USING (
    user_id = auth.uid() 
    OR is_shared = TRUE 
    OR id IN (SELECT get_user_collaborated_watchlist_ids(auth.uid()))
  );
CREATE POLICY "Users can insert own watchlists" ON watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlists" ON watchlists FOR UPDATE 
  USING (user_id = auth.uid() OR id IN (
    SELECT watchlist_id FROM watchlist_collaborators 
    WHERE user_id = auth.uid() AND can_edit = TRUE
  ));
CREATE POLICY "Users can delete own watchlists" ON watchlists FOR DELETE USING (auth.uid() = user_id);

-- Watchlist items: Users can read items from accessible watchlists, manage if owner/collaborator
CREATE POLICY "Users can view items from accessible watchlists" ON watchlist_items FOR SELECT 
  USING (watchlist_id IN (
    SELECT id FROM watchlists 
    WHERE user_id = auth.uid() OR is_shared = TRUE OR id IN (
      SELECT watchlist_id FROM watchlist_collaborators WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "Users can insert items to accessible watchlists" ON watchlist_items FOR INSERT 
  WITH CHECK (watchlist_id IN (
    SELECT id FROM watchlists 
    WHERE user_id = auth.uid() OR id IN (
      SELECT watchlist_id FROM watchlist_collaborators 
      WHERE user_id = auth.uid() AND can_edit = TRUE
    )
  ));
CREATE POLICY "Users can delete items from accessible watchlists" ON watchlist_items FOR DELETE 
  USING (watchlist_id IN (
    SELECT id FROM watchlists 
    WHERE user_id = auth.uid() OR id IN (
      SELECT watchlist_id FROM watchlist_collaborators 
      WHERE user_id = auth.uid() AND can_edit = TRUE
    )
  ));

-- Watchlist collaborators: Users can view/manage collaborators for their watchlists
CREATE POLICY "Users can view collaborators of accessible watchlists" ON watchlist_collaborators FOR SELECT 
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid() OR is_shared = TRUE
  ));
CREATE POLICY "Watchlist owners can add collaborators" ON watchlist_collaborators FOR INSERT 
  WITH CHECK (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));
CREATE POLICY "Watchlist owners can remove collaborators" ON watchlist_collaborators FOR DELETE 
  USING (watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id = auth.uid()
  ));

-- Functions for calculating ratings

-- Function to get title rating statistics
CREATE OR REPLACE FUNCTION get_title_rating_stats(p_title_id UUID)
RETURNS TABLE (
  average_rating NUMERIC,
  total_ratings BIGINT,
  star_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(rating)::NUMERIC, 0) as average_rating,
    COUNT(*)::BIGINT as total_ratings,
    jsonb_object_agg(rating, count) as star_breakdown
  FROM (
    SELECT 
      rating,
      COUNT(*) as count
    FROM title_ratings
    WHERE title_id = p_title_id
    GROUP BY rating
  ) rating_counts;
END;
$$ LANGUAGE plpgsql;

-- Function to get season average rating
CREATE OR REPLACE FUNCTION get_season_rating_stats(
  p_title_id UUID,
  p_season_number INTEGER
)
RETURNS TABLE (
  average_rating NUMERIC,
  rated_episodes BIGINT,
  total_episodes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(rating)::NUMERIC, 0) as average_rating,
    COUNT(DISTINCT episode_number)::BIGINT as rated_episodes,
    (SELECT COUNT(*) FROM episode_ratings 
     WHERE title_id = p_title_id AND season_number = p_season_number)::BIGINT as total_episodes
  FROM episode_ratings
  WHERE title_id = p_title_id AND season_number = p_season_number;
END;
$$ LANGUAGE plpgsql;

-- Storage Policies (Avatars)
-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to avatars
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Policy: Allow authenticated users to upload avatars (folder must match user ID)
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (name LIKE (auth.uid() || '/%'))
);

-- Policy: Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);

-- Policy: Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);
