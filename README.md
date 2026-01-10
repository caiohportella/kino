# Kino - Movie & TV Series Tracking App

A comprehensive movie and TV series tracking application similar to TV Time and Letterboxd, built with React Native (Expo), TypeScript, Supabase, and TMDb API.

## Features

- 🔍 **Search**: Search for movies and TV shows in any language using TMDb API
- ⭐ **Ratings**: Rate movies (1-5 stars) and individual TV episodes
- 📺 **Episode Tracking**: Mark episodes as watched and track your progress through TV series
- 📅 **Watch Diary**: Log your viewing history with custom dates and notes
- 📋 **Watchlists**: Create custom watchlists and share them with friends
- 👥 **Collaboration**: Share watchlists and collaborate on ratings
- 🔐 **Authentication**: Secure login with email/password and OAuth support

## Tech Stack

- **Frontend**: React Native (Expo Router)
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS)
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **External API**: TMDb (The Movie Database)

## Prerequisites

- Node.js 18+ and pnpm
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- TMDb API key ([Get one here](https://www.themoviedb.org/settings/api))

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd kino
pnpm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `database/schema.sql`
3. Enable email/password authentication in Authentication settings
4. (Optional) Configure OAuth providers (Google, Apple, etc.)

### 3. Get TMDb API Key

1. Sign up at [themoviedb.org](https://www.themoviedb.org/)
2. Go to Settings > API
3. Request an API key
4. Copy your API key

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TMDB_API_KEY=your_tmdb_api_key
```

### 5. Run the App

```bash
# Start the development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android

# Run on web
pnpm web
```

## Project Structure

```
kino/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app tabs
│   └── title/             # Title detail screens
├── components/            # Reusable UI components
├── services/             # API and database services
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
├── utils/              # Utility functions
└── database/           # Database schema
```

## Database Schema

The app uses Supabase (PostgreSQL) with the following main tables:

- `user_profiles` - User profile information
- `titles` - Movie and TV show metadata
- `title_ratings` - User ratings for movies/series
- `episode_ratings` - User ratings for TV episodes
- `watch_diary` - Viewing history entries
- `watchlists` - User-created watchlists
- `watchlist_items` - Items in watchlists
- `watchlist_collaborators` - Shared watchlist permissions

See `database/schema.sql` for the complete schema with Row Level Security policies.

## Key Features Implementation

### Search
- Multi-language search using TMDb API
- Displays movies and TV shows in a grid
- Click to view details

### Title Details
- Full information: synopsis, cast, director, genres
- Community ratings with star breakdown
- User rating with first-time/rewatch toggle
- For TV shows: Link to episode tracking

### Episode Tracking
- Season/episode list
- Individual episode ratings
- Track watched status
- Calculate season averages

### Watch Diary
- Log viewing history
- Custom dates
- Notes and thoughts
- Filter and sort

### Watchlists
- Create custom lists
- Add titles
- Share with other users
- Collaborative editing

## Development

### Code Style

- ESLint for linting
- Prettier for formatting
- Run `pnpm format` to format code

### Architecture Principles

- **SOLID**: Single responsibility, dependency inversion
- **DRY**: Reusable components and utilities
- **Type Safety**: Full TypeScript coverage
- **Modular**: Clear separation of concerns

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `TMDB_API_KEY` | Your TMDb API key |

## Troubleshooting

### Common Issues

1. **"Unable to resolve path to module"**
   - Ensure path aliases are configured in `tsconfig.json`
   - Restart the Metro bundler

2. **Supabase connection errors**
   - Verify your Supabase URL and keys
   - Check Row Level Security policies

3. **TMDb API errors**
   - Verify your API key is correct
   - Check API rate limits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm format` and `pnpm lint`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- [TMDb](https://www.themoviedb.org/) - Movie and TV data
- [Supabase](https://supabase.com/) - Backend and database
- [Expo](https://expo.dev/) - React Native framework
