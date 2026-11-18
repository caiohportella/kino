# Connect to Kino

Add your Kino deployment's HTTPS `/mcp` endpoint using the AI host's custom
remote MCP controls. Choose browser OAuth or the host's automatic mode. Sign
in to Kino, enable **AI Integration** if prompted, then review the requested
permissions. The host manages OAuth credentials.

Kino's **Settings → AI Integration** applies to all assistants. Turn it off
to revoke existing access. Enable it again and authorize a fresh connection
to resume. Agensi delivers the skill instructions. Add Kino as a separate
connection in a compatible AI host.

Use the deployment's official Kino origin. The public endpoint is
`https://kino.vercel.app/mcp` once the integration is deployed there.

Call the tools with structured arguments. Use the resulting structured
content or JSON text fallback.

| Command | JSON arguments | Main response fields |
| --- | --- | --- |
| `search_titles` | `query`, optional `media_type` (movie or tv), `year`, `limit` | `candidates`, `ambiguous`, `best_match_id` |
| `find_watchlist` | optional `name`, absent for the configured default | `matches`, optional `ambiguous` |
| `add_to_watchlist` | `list_id`, `title_id`, `idempotency_key` | `status`, `list`, `title` |
| `create_watchlist` | `name`, `visibility` (private or public), optional `description`, `idempotency_key` | `list` |
| `log_watch` | `title_id`, optional `rating`, `watched_on`, `rewatch`, `idempotency_key` | `entry` |
| `mark_episodes` | `series_id`, `selector`, optional `rating`, `watched_on`, `idempotency_key` | `series`, affected and skipped episodes, `progress`, date and rating scope |
| `get_diary` | optional `limit`, `cursor`, `since`, `until`, `order`, `collapse_episodes` | `entries`, `next_cursor`, `total` |
| `get_taste_profile` | empty object | `top_rated`, `recent`, `genre_weights`, `rating_distribution`, `counts` |
| `get_candidates` | optional `media_type`, `limit`, `seed_count` | `candidates`, `counts` |

Episode selectors include `{"type":"first_n","n":5,"scope":"series_order"}`,
`{"type":"next_unwatched","count":1}`, `{"type":"range","season":1,"from":1,"to":5}`,
and `{"type":"season","season":2}`. Use ratings in half-star steps from 0.5 to
5. Log a series without a title rating or rate its individual episodes. Episode
ratings apply only to the newly marked episodes. Dates use ISO YYYY-MM-DD. Omit
a date or supply null to use the server's local date.

Title IDs look like `movie:123` or `tv:123`. Use the exact returned ID and list
UUID. Never compose a write ID based solely on a display name. If a cursor is
present, use it with the same diary filters. If a list link is private or shared,
the recipient needs Kino access.

## Errors and evidence

- `unauthorized` means the token is missing, invalid, expired, or revoked.
  Use the host's sign-in controls to reconnect. `forbidden` means the scope or list editing
  access is insufficient.
- `list_not_found`, `default_list_required`, `ambiguous_list`, and
  `name_conflict` can include candidate lists. Offer substitutions for user
  selection. `title_not_found` or an ambiguous search calls for a refined query.
- `invalid_rating` and `validation_error` require a corrected request.
  `nothing_to_mark` can include progress and skipped episodes.
- `rate_limited` includes `retry_after` in seconds. For `temporary_unavailable`,
  `transport_error`, or `invalid_response`, retry the exact write with its
  original key. `idempotency_conflict` means the key already describes a
  different intent. Do not auto-retry with a new key.
- `insufficient_history` includes real counts. Offer a clearly labeled
  preference-based alternative. Only cite a rating when returned as evidence.
  Describe a series seed's episode-average as an episode-average. Kino excludes
  watched and partially watched titles. Watchlisted but unwatched titles can
  appear with an explicit flag. Streaming providers are currently omitted.
