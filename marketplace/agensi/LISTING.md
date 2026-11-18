# Kino Personal Cinema Companion

Connect your Kino account to manage watchlists, log movies and episodes, view
your diary, and discover personalized recommendations through natural language.

## What it does

- Add a resolved movie or series to a named or configured default watchlist.
- Create private and public lists and see the visibility and item count in Kino.
- Log a movie, record a half-star rating, and keep previous diary events.
- Mark the first, next, or specified released episodes and see updated progress.
- Read your diary with posters, timestamps by local date, and episode groups.
- Find unwatched candidates with a traceable seed from your actual rated history.
- Normalize CSV or JSON and analyze viewing patterns in standalone mode.

## Try asking

1. Add Interstellar to my Kino watchlist.
2. Add The Odyssey to my Must Binge watchlist.
3. Mark Dune: Part Two as watched and rate it 4.5 stars.
4. Create a private watchlist called Sci-Fi Essentials.
5. Create a public watchlist called New Year's Goals with description “living the life”.
6. Mark the first five episodes of Severance as watched.
7. Mark my next episode of The Mentalist as watched and rate it 4 stars.
8. Show my latest Kino diary entries.
9. Recommend something based on my Kino viewing history.

## Account connection

Add your Kino deployment's HTTPS `/mcp` endpoint in a client that supports
remote Streamable HTTP MCP with OAuth. Sign in to Kino, enable **AI Integration**
when prompted, and approve the scopes you want. Use **Settings → AI Integration**
to disconnect all assistants at once.

Agensi delivers the skill. Add Kino as a separate connection through the
AI client's connector controls. The host needs HTTPS access to Kino.
Poster rendering may also fetch images from `https://image.tmdb.org`.
See the Kino setup guide for host workflows and verification status.

Kino uses TMDB for catalog metadata and related titles. The AI host receives
the account data you authorize. Follow its privacy and retention settings.

## FAQ

**What if the title name matches multiple works?** The agent shows the
candidates and waits for you to choose.

**Can I use it without an account connection?** Yes. Standalone mode processes
supplied preferences and files into local insights and artifacts.

**Can it show streaming providers?** The current API omits provider data.
Recommendations depend on catalog coverage and at least five distinct rated
titles. Rated recommendations use seeds with a score of at least 4/5.

**Can I log an unreleased episode or change an existing episode rating?**
Connected episode commands only write new, released watch events. Existing
episode history stays intact.

Suggested categories include Productivity, Workflow Automation, and Research
& Analysis. Search keywords include Kino, movie diary, watchlist, movie
recommendations, TV tracker, episode progress, and CSV watch history.

[Agent API and setup](https://github.com/caiohportella/kino/blob/main/docs/KINO_AGENT_API.md)
