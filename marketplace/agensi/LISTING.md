# Kino Personal Cinema Companion

Manage your Kino watchlists, log movies and episodes, and find your next watch from the assistant you already use.

Kino connects your viewing diary to a compatible AI assistant. Tell it what you watched, catch up on your recent diary entries, or look for something new based on the films and series you’ve rated. It checks your Kino account and confirms what it saved after each update.

## What you can do

- **Organize watchlists.** Create public or private lists and add movies or series to a named list or your configured default.
- **Keep a viewing diary.** Log movies and rewatches, add half-star ratings, and review recent entries with dates and Kino links.
- **Pick up a series where you left off.** Mark the first few episodes, a range, or the next unwatched episode. Kino uses your watch history to find what’s next and records released episodes.
- **Find something new.** Get unwatched suggestions and see which titles from your rated history inspired them.
- **Work from an export.** Use standalone mode to clean up a CSV or JSON viewing history, spot duplicates, or summarize your viewing habits.

## Try asking

1. “Add Interstellar to my Kino watchlist.”
2. “Add The Odyssey to my Must Binge watchlist.”
3. “Log Dune: Part Two as watched and give it 4.5 stars.”
4. “Create a private watchlist called Sci-Fi Essentials.”
5. “Create a public watchlist called New Year's Goals with the description ‘living the life’.”
6. “Mark the first five episodes of Severance as watched.”
7. “Mark my next unwatched episode of The Mentalist and rate it 4 stars.”
8. “Show my latest Kino diary entries.”
9. “Recommend something I haven’t watched based on my Kino ratings.”

## Connect your account

Connected mode requires a Kino deployment with AI Integration enabled and an assistant that supports custom remote MCP connectors over HTTPS with browser OAuth. Agensi provides the skill instructions. Add the Kino connection separately in your assistant.

1. Add your Kino deployment’s HTTPS `/mcp` URL in your assistant’s connector settings.
2. Sign in to Kino in your browser. Enable **AI Integration** if prompted.
3. Review the requested permissions and approve the access you want to grant. Your assistant handles the sign-in credentials.

Setup varies by host, plan, and workspace. The guide covers Claude, Claude Code, ChatGPT, and Codex and describes the verification status for each. [Kino setup guide](https://github.com/caiohportella/kino/blob/a530b7d2da0cc74e06702cf317372c8e9745b556/docs/KINO_AGENT_API.md)

## Permissions and privacy

Read access covers your watchlists, diary, ratings, and viewing history. Write access lets the assistant save requested changes. You can disconnect all assistants from **Settings → AI Integration**. Turning access back on requires a fresh approval.

Kino uses TMDB for title metadata and related titles. Your assistant receives the Kino data you authorize. Its privacy and retention settings apply to that data.

## FAQ

**What if multiple titles match?** Choose a match before Kino saves the update. If you haven’t set a default watchlist, choose which list to use.

**What if I’ve only rated a few titles?** Personalized suggestions require at least five distinct rated titles. You can also ask for suggestions based on preferences you share.

**Can I use the skill without connecting Kino?** Yes. Standalone mode works with files and preferences you supply and returns local summaries and recommendations.

## Marketplace metadata

- **Suggested categories** · Productivity, Workflow Automation, Research & Analysis
- **Search keywords** · Kino, movie diary, watchlist, movie recommendations, TV episode tracker, viewing history, CSV
