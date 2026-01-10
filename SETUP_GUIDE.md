# Kino Setup Guide

## Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TMDB_API_KEY=your-tmdb-api-key
```

### 2. Supabase Setup

1. **Create Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for database to initialize

2. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `database/schema.sql`
   - Paste and run in SQL Editor
   - Verify tables are created

3. **Configure Authentication**
   - Go to Authentication > Providers
   - Enable Email provider
   - (Optional) Enable OAuth providers (Google, Apple, etc.)
   - Configure redirect URLs if using OAuth

### 3. TMDb API Setup

1. **Get API Key**
   - Sign up at [themoviedb.org](https://www.themoviedb.org/)
   - Go to Settings > API
   - Request API key (free tier available)
   - Copy API key to `.env` file

### 4. Run the App

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on specific platform
pnpm ios      # iOS simulator
pnpm android  # Android emulator
pnpm web      # Web browser
```

## Database Schema Overview

The app uses the following main tables:

- **user_profiles**: Extended user information
- **titles**: Cached movie/TV show data from TMDb
- **title_ratings**: User ratings for movies/entire series
- **episode_ratings**: User ratings for individual TV episodes
- **watch_diary**: Viewing history entries
- **watchlists**: User-created watchlists
- **watchlist_items**: Titles in watchlists
- **watchlist_collaborators**: Shared watchlist permissions

All tables have Row Level Security (RLS) enabled for data protection.

## Testing the App

### 1. Authentication
- Register a new account
- Log in with email/password
- Test OAuth (if configured)

### 2. Search
- Search for movies (e.g., "Inception")
- Search for TV shows (e.g., "Breaking Bad")
- Click on results to view details

### 3. Rating
- Rate a movie (1-5 stars)
- Toggle between "First Time" and "Rewatch"
- View community ratings

### 4. TV Shows
- Open a TV show detail page
- Click "View Episodes & Rate"
- Rate individual episodes
- Track season progress

### 5. Watch Diary
- Rate titles to automatically create diary entries
- View your viewing history
- Add custom notes (future enhancement)

### 6. Watchlists
- Create a new watchlist
- Add titles to watchlist
- Share watchlist with other users (future enhancement)

## Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache and restart
pnpm start --clear
```

### TypeScript Errors
```bash
# Check for type errors
pnpm tsc --noEmit
```

### Supabase Connection
- Verify URL and keys in `.env`
- Check Supabase project is active
- Verify RLS policies are set correctly

### TMDb API Errors
- Verify API key is correct
- Check API rate limits (40 requests per 10 seconds)
- Ensure internet connection

## Next Steps

1. **OAuth Setup** (Optional)
   - Configure Google OAuth in Supabase
   - Add redirect URLs
   - Test OAuth flow

2. **Customization**
   - Update app name/icon in `app.json`
   - Customize colors in `tailwind.config.js`
   - Add app-specific features

3. **Deployment**
   - Build for production: `expo build`
   - Deploy to App Store/Play Store
   - Set up production Supabase project

## Support

For issues or questions:
- Check `DEVELOPMENT_PLAN.md` for architecture details
- Review `README.md` for general information
- Check Supabase and TMDb documentation
