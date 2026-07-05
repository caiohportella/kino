// User and profile types

export interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  banner_url?: string | null
  bio: string | null
  created_at: string
  updated_at: string
  followers_count?: number // Fetched separately or via view
  following_count?: number // Fetched separately or via view
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface FollowerInfo extends UserProfile {
  followedAt: string
  isMutual: boolean
  mutualSince?: string
}
