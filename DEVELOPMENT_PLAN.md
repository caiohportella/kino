# Kino - Movie & TV Series Tracking App
## Development Plan & Architecture

### Overview
Kino is a comprehensive movie and TV series tracking application similar to TV Time and Letterboxd, built with React Native (Expo), TypeScript, Supabase, and TMDb API.

---

## Architecture

### Tech Stack
- **Frontend**: React Native (Expo Router)
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend/Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (with OAuth support)
- **External API**: TMDb (The Movie Database) API
- **State Management**: React Hooks
- **Form Handling**: React Hook Form + Zod
- **Date Utilities**: date-fns

### Project Structure
```
kino/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── home.tsx
│   │   ├── search.tsx
│   │   ├── diary.tsx
│   │   ├── watchlists.tsx
│   │   └── profile.tsx
│   ├── title/[id].tsx     # Title detail screen
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
│   ├── RatingStars.tsx
│   ├── TitleCard.tsx
│   ├── SearchBar.tsx
│   └── ...
├── services/             # Business logic & API services
│   ├── tmdb.ts           # TMDb API client
│   └── database.ts       # Supabase database operations
├── hooks/               # Custom React hooks
│   ├── useAuth.ts
│   └── useSearch.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   ├── supabase.ts
│   └── tmdb-transform.ts
└── database/           # Database schema
    └── schema.sql
```

---

## Database Schema

### Core Tables

#### `user_profiles`
- Extends Supabase auth.users
- Stores user profile information (username, display name, avatar, bio)

#### `titles`
- Stores movie and TV show metadata
- Caches TMDb data for performance
- Fields: tmdb_id, type, title, synopsis, cover_image, genres, cast, etc.

#### `title_ratings`
- User ratings for movies or entire TV series
- Fields: user_id, title_id, rating (1-5), watch_type, watched_at

#### `episode_ratings`
- User ratings for individual TV episodes
- Fields: user_id, title_id, season_number, episode_number, rating, watch_type

#### `watch_diary`
- Diary entries for watched titles
- Fields: user_id, title_id, watched_at, watch_type, notes

#### `watchlists`
- User-created watchlists
- Fields: user_id, name, description, thumbnail, is_shared

#### `watchlist_items`
- Items in watchlists
- Fields: watchlist_id, title_id, added_by, added_at

#### `watchlist_collaborators`
- Shared watchlist collaborators
- Fields: watchlist_id, user_id, can_edit

### Database Functions
- `get_title_rating_stats()` - Calculate rating statistics for titles
- `get_season_rating_stats()` - Calculate average ratings for TV seasons

---

## Features Implementation

### ✅ Completed
1. **Project Setup**
   - Dependencies installed
   - TypeScript configuration
   - ESLint/Prettier setup
   - Path aliases configured

2. **Core Services**
   - TMDb API service with full search and detail endpoints
   - Database service with CRUD operations
   - Type definitions for all entities

3. **UI Components**
   - RatingStars component
   - TitleCard component
   - SearchBar component
   - Reusable, modular components following SOLID principles

4. **Screens**
   - Search screen with TMDb integration
   - Title detail screen (movies & TV shows)
   - Authentication screens (login/register)
   - Home, Diary, Watchlists, Profile screens

5. **Navigation**
   - Tab-based navigation
   - Auth flow routing
   - Dynamic title detail routes

### 🚧 In Progress / Pending

1. **Episode Tracking for TV Shows**
   - Season/episode list view
   - Individual episode rating
   - Episode watch status tracking
   - Season average calculation

2. **Watch Diary Enhancements**
   - Add custom date selection
   - Notes/thoughts for entries
   - Filter and sort options

3. **Watchlist Management**
   - Create/edit watchlists
   - Share watchlists with other users
   - Collaborative editing
   - Watchlist thumbnails

4. **OAuth Integration**
   - Google OAuth
   - Apple OAuth (iOS)
   - Other providers

5. **Additional Features**
   - User profiles with stats
   - Social features (follow users, see their ratings)
   - Recommendations based on viewing history
   - Export/import data

---

## API Integration

### TMDb API
- **Base URL**: `https://api.themoviedb.org/3`
- **Endpoints Used**:
  - `/search/multi` - Search movies and TV shows
  - `/movie/{id}` - Movie details
  - `/tv/{id}` - TV show details
  - `/movie/{id}/credits` - Movie cast & crew
  - `/tv/{id}/credits` - TV cast & crew
  - `/tv/{id}/season/{season_number}` - Season details
  - `/tv/{id}/season/{season_number}/episode/{episode_number}` - Episode details

### Supabase
- Authentication (email/password + OAuth)
- PostgreSQL database with Row Level Security (RLS)
- Real-time subscriptions (for future features)

---

## Security & Best Practices

### Authentication
- Supabase Auth handles secure authentication
- Row Level Security (RLS) policies protect user data
- OAuth providers for third-party login

### Data Protection
- API keys stored in environment variables
- RLS policies ensure users can only access their own data
- Shared watchlists have explicit permission checks

### Code Quality
- **SOLID Principles**: Services are single-responsibility, interfaces are well-defined
- **DRY**: Reusable components and utility functions
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Try-catch blocks and user-friendly error messages
- **Performance**: Caching TMDb data in database, optimized queries

---

## Environment Variables

Create a `.env` file with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TMDB_API_KEY=your_tmdb_api_key
```

---

## Setup Instructions

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Set Up Supabase**
   - Create a Supabase project
   - Run the SQL schema from `database/schema.sql`
   - Configure authentication providers (email/password, OAuth)

3. **Get TMDb API Key**
   - Sign up at https://www.themoviedb.org/
   - Get API key from account settings

4. **Configure Environment**
   - Create `.env` file with required variables
   - Update `app.json` if needed

5. **Run the App**
   ```bash
   pnpm start
   ```

---

## Next Steps

1. **Implement Episode Tracking**
   - Create episode list component
   - Add episode rating functionality
   - Calculate season averages

2. **Enhance Watch Diary**
   - Date picker for custom dates
   - Rich text notes
   - Search and filter

3. **Complete Watchlist Features**
   - Create/edit watchlist UI
   - Share functionality
   - Collaborative editing

4. **Add OAuth**
   - Configure OAuth providers in Supabase
   - Implement OAuth buttons in auth screens

5. **Testing**
   - Unit tests for services
   - Integration tests for API calls
   - E2E tests for critical flows

6. **Performance Optimization**
   - Image caching
   - Lazy loading
   - Pagination for lists

7. **UI/UX Polish**
   - Animations
   - Loading states
   - Empty states
   - Error boundaries

---

## Scalability Considerations

1. **Database**
   - Indexes on frequently queried fields
   - Pagination for large result sets
   - Caching strategy for TMDb data

2. **API Calls**
   - Rate limiting awareness
   - Batch requests where possible
   - Cache responses

3. **State Management**
   - Consider Zustand or Redux for complex state
   - React Query for server state (future)

4. **Offline Support**
   - Cache frequently accessed data
   - Queue actions when offline

---

## License & Credits

- TMDb API: https://www.themoviedb.org/
- Supabase: https://supabase.com/
- Expo: https://expo.dev/
