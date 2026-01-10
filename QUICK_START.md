# Quick Start Guide - What's Missing

## ✅ What You Have
- ✅ All code files are in place
- ✅ Dependencies are installed (node_modules exists)
- ✅ TypeScript configuration is set up
- ✅ Database schema is ready

## ❌ What's Missing

### 1. Environment Variables File (`.env`)

Create a `.env` file in the root directory with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
```

**Important:** Expo requires the `EXPO_PUBLIC_` prefix for environment variables to be accessible in the app.

### 2. Supabase Project Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Sign up/login and create a new project
   - Wait for the project to initialize (takes ~2 minutes)

2. **Get Your Credentials**
   - Go to Project Settings > API
   - Copy your:
     - Project URL (e.g., `https://xxxxx.supabase.co`)
     - `anon` `public` key (this is your anon key)

3. **Set Up Database**
   - Go to SQL Editor in Supabase dashboard
   - Copy the entire contents of `database/schema.sql`
   - Paste and run it in the SQL Editor
   - Verify tables are created (check Table Editor)

4. **Enable Authentication**
   - Go to Authentication > Providers
   - Enable "Email" provider
   - (Optional) Enable OAuth providers if you want Google/Apple login

### 3. TMDb API Key

1. **Sign Up**
   - Go to https://www.themoviedb.org/
   - Create a free account

2. **Get API Key**
   - Go to Settings > API
   - Click "Request an API Key"
   - Select "Developer" (free tier)
   - Fill out the form
   - Copy your API key (v3 auth)

### 4. Install Environment Variable Package (if needed)

Expo may need additional configuration. Check if you need to install:

```bash
pnpm add -D @expo/config-plugins
```

Or use `expo-constants` which is already installed. However, for Expo SDK 54, you might need to configure environment variables differently.

## 🚀 Steps to Run

1. **Create `.env` file** with your credentials (see above)

2. **Update code to use EXPO_PUBLIC_ prefix** (if not already done)

3. **Start the app:**
   ```bash
   pnpm start
   ```

4. **Run on your platform:**
   ```bash
   pnpm ios      # iOS
   pnpm android  # Android  
   pnpm web      # Web
   ```

## ⚠️ Common Issues

1. **"Missing Supabase environment variables" error**
   - Make sure `.env` file exists in root directory
   - Make sure variables have `EXPO_PUBLIC_` prefix
   - Restart Metro bundler after creating `.env`

2. **"TMDB_API_KEY is not set" error**
   - Check `.env` file has `EXPO_PUBLIC_TMDB_API_KEY`
   - Restart Metro bundler

3. **Database connection errors**
   - Verify Supabase project is active
   - Check URL and keys are correct
   - Ensure database schema was run successfully

## 📝 Next Steps After Setup

1. Test authentication (register/login)
2. Test search functionality
3. Test rating movies/TV shows
4. Test episode tracking for TV shows
