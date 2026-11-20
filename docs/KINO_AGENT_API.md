# Kino Agent API and remote MCP

## Connect from an AI assistant

Add the issuing Kino deployment's HTTPS `/mcp` URL in your AI client's
custom remote MCP controls. For Kino's public deployment, use
`https://kinotv.vercel.app/mcp` once the rollout is complete. Sign in with
your existing Kino account. Enable
**AI Integration** if prompted, then approve the requested scopes. The
client manages OAuth credentials. Turning the switch off revokes all
connections. Enable it again and authorize a fresh connection to reconnect.

Agensi delivers the skill instructions and examples. Add Kino as a separate
connection in the host. [Agensi MCP](https://www.agensi.io/docs/mcp-server)

| Host | Setup | Compatibility |
| --- | --- | --- |
| Claude web or desktop | In Customize → Connectors, add a custom Web connector with the Kino URL. Select automatic registration, then Connect. | Kino allowlists Claude's exact hosted callback. The published identity endpoint returned HTTP 403 during the smoke check. Plan and organization settings determine access. |
| Claude Code | Add a remote HTTP MCP server with the Kino URL, then use the in-session MCP authorization controls. In the CLI, use `claude mcp add --transport http kino <Kino URL>` followed by `/mcp`. | Public dynamic registration accepts a registered loopback callback. |
| ChatGPT with custom MCP | In custom MCP app creation, supply the Kino URL and choose OAuth with the published ChatGPT identity or automatic registration. | Kino supports the stable CIMD identity and callback. Workspace settings and feature eligibility apply. Enterprise domain restriction requires OIDC UserInfo, which Kino does not provide. |
| Codex with remote MCP | Add Kino as Streamable HTTP in supported MCP settings and choose Authenticate. With the CLI and a browser, use `codex mcp add kino --url <Kino URL>`, then `codex mcp login kino`. | Kino supports the stable Codex CIMD identity and its published loopback callback. |
| Other clients | Configure Streamable HTTP, then use browser OAuth. | Public S256 PKCE clients with a registered loopback callback are eligible. External callbacks require a reviewed identity and exact allowlisted URL. |

Provider-specific setup follows published docs and needs staging smoke tests.
The public ChatGPT and Codex client documents were reachable and advertised
the callbacks and public-client method supported by Kino.
[Claude connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
· [Claude Code](https://code.claude.com/docs/en/mcp)
· [ChatGPT OAuth](https://developers.openai.com/plugins/build/auth)
· [Codex MCP](https://developers.openai.com/codex/mcp)

## Deploy to staging

Apply `database/migrations/20261117_kino_agent_api.sql` and then
`database/migrations/20261118_kino_ai_oauth.sql` to the Kino Supabase database.
If the Agent API migration is already applied, run only the OAuth migration.
For example, with a staging PG service entry:

    psql 'service=kino-staging' -X -v ON_ERROR_STOP=1 -1 -f database/migrations/20261118_kino_ai_oauth.sql

Keep the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
server-only `SUPABASE_SERVICE_ROLE_KEY`, and TMDB configuration. Set
`KINO_AGENT_ORIGIN` to the exact public HTTPS origin. Serve discovery and
`/oauth/*` and `/mcp` on that origin without proxy redirects. Maintain the
existing Supabase browser sign-in callback. Set ingress limits for anonymous
registration and authorization traffic.

### Troubleshoot authorization on Vercel

Use the HTTPS URL advertised by OAuth discovery. Vercel redirects HTTP requests
for `kinotv.vercel.app` to HTTPS with a 308 and preserves the query string.
If discovery and the unauthenticated MCP challenge work but authorization
returns 503, find the response's `X-Request-Id` in the Vercel Runtime Logs
under `kino.oauth.authorization_failed`. Discovery can succeed independently
of the authorization database.

| Stage | What to check |
| --- | --- |
| `client_metadata` | The provider's pinned metadata endpoint must be reachable from Vercel and publish a matching client identity, callback and public-client method. |
| `database_client` | Verify `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the Vercel environment for the affected deployment. Both must point to the same Supabase project. The browser login separately uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `authorization_flow_insert` | `PGRST205` or `42P01` points to a missing table or stale PostgREST schema cache. Check that the OAuth migration ran in that Supabase project. `42501` or a 401/403 points to the service credential or database grants. |
| `consent_redirect` | Verify `KINO_AGENT_ORIGIN=https://kinotv.vercel.app` for the public deployment and check for failures constructing the consent response. |

If you change a Vercel environment variable, create a fresh deployment to pick
it up. Keep the service-role key in server-only configuration.

## OAuth and MCP architecture

- `/mcp` uses the maintained TypeScript SDK for Streamable HTTP. All nine
  tools share the existing Agent API service and SQL transactions.
- `/.well-known/oauth-protected-resource/mcp` advertises the MCP resource.
  `/.well-known/oauth-authorization-server` advertises the issuer and endpoints
  for authorization, exchange, registration and revocation. Supabase verifies
  the user's existing browser sign-in.
- Kino issues distinct OAuth credentials for its resource grants and custom
  `kino.read` and `kino.write` scopes. Callback validation binds the exact
  redirect, client, state, and issuer. Single-use S256 PKCE codes expire in
  two minutes. An HttpOnly nonce and the reviewing account bind the browser
  continuation. Kino fetches only pinned client metadata URLs. Dynamic
  registrations stay unverified on the consent screen.
- Access tokens expire after five minutes. The refresh family lasts at most
  30 days and rotates atomically. Reusing a refresh token revokes its family.
  Credentials are stored as hashes. SQL checks the account toggle under the
  same lock that commits existing mutations.
- The migration switches AI access off by default and revokes prior manual
  credentials. The [developer HTTP adapter](../marketplace/agensi/dev/README.md)
  remains available for isolated regression tests.

[MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
· [Supabase OAuth server](https://supabase.com/docs/guides/auth/oauth-server)

## Tool and legacy HTTP contracts

MCP tool names and request parameters match the operations below. Successful
results expose the existing JSON receipt as tool structured content.

For developer diagnostics, the legacy HTTP equivalents are
`POST /api/agent/v1/<operation>`. Omitted optional fields use the defaults.
Unknown fields are rejected. The request body limit is 8 KiB. Resolve
identities before writing.

| Operation | Scope | Body | Response |
| --- | --- | --- | --- |
| `search_titles` | read | `query`, optional `media_type`, `year`, `limit` (default 5) | `candidates`, `ambiguous`, `best_match_id`. Candidates add `overview_short`, `popularity` and `exact_title_match` |
| `find_watchlist` | read | optional `name`. Send an empty object for the default | `matches`, `ambiguous` for named searches |
| `add_to_watchlist` | write | `list_id`, `title_id`, `idempotency_key` | `status` of `added` or `already_present`, `list`, `title` |
| `create_watchlist` | write | `name`, `visibility` (private or public), optional `description`, `idempotency_key` | `list` |
| `log_watch` | write | `title_id`, optional `rating`, `watched_on`, `rewatch`, `idempotency_key` | `entry` with ID, title, rating, date, rewatch, prior entry and whether the date defaulted |
| `mark_episodes` | write | `series_id`, `selector`, optional `rating` and `watched_on`, `idempotency_key` | `series`, `resolved_episodes`, `skipped_already_watched`, `rating_applied`, `rating_scope`, `watched_on`, `date_defaulted`, `progress` |
| `get_diary` | read | `limit` (10), `cursor` (null), `since`, `until`, `order` (watched_on_desc), `collapse_episodes` (true) | `entries`, `total`, `next_cursor` |
| `get_taste_profile` | read | empty object | `top_rated`, `recent`, `genre_weights`, `rating_distribution`, `counts` |
| `get_candidates` | read | `media_type`, `limit` (8), `seed_count` (5) | `candidates`, `counts`. Candidates include a title, overview, genres, runtime or seasons, TMDB vote average if available, traceable seed, and watchlist flag |

All success responses add `meta` with `user.locale`, `user.timezone`,
`user.region`, `today`, `request_id`, and `attribution`. The consent session records a supported Kino language (fallback en-GB and GB) and an
IANA time zone (default UTC). A missing date uses the local day at the request
boundary. ISO date filters include both endpoints. Future watch dates are
rejected. Ratings use half-stars from 0.5 to 5.

A TitleRef uses a stable type-qualified TMDB identity such as `movie:123` in
`id`, a distinct numeric `tmdb_id`, `media_type`, localized `title`,
`original_title`, `year`, `url` and `poster` (null or sizes w92, w185,
w342, w500 and alt text). The API resolves write IDs through TMDB and Kino's
title persistence. If an existing catalog row uses the same numeric TMDB ID
for another media type, the write rejects the unresolved title.

ListRef includes `id` (Kino UUID), `name`, `visibility`, `description`,
`item_count`, and `url`. A private or shared URL requires access.
Watchlist lookup searches owned lists and collaborations. Kino carries forward a previous owned default when available. Otherwise the response asks the user to choose. Existing
collaborator permissions determine who can add to a list.

An idempotency key is 1–128 characters from ASCII letters, digits, periods,
underscores, colons and hyphens. Use a unique key per intended change and
repeat the original parameters on retries. Replay scope is user plus operation.
A new key after a transport failure may add another diary entry. Receipt
records remain while the account exists. List and episode writes are serialized
where they share account state, and multi-row writes commit with the receipt.

### Episodes, diary and recommendations

Supported episode selectors are `{"type":"first_n","n":5,"scope":"series_order"}`,
`{"type":"next_unwatched","count":1}`, `{"type":"range","season":1,"from":1,"to":5}`,
and `{"type":"season","season":2}`. Only explicit season or range selectors
can include released season-zero specials. Progress considers released
regular episodes. Each episode result has season, episode, name, runtime_min
and still. Progress includes watched, total, season and next_episode.
A missing rating leaves existing episode ratings intact. A movie diary event
and its optional current title rating commit together. A TV watch event has
no title rating. Rate individual TV episodes.

Diary entries have `id`, `title`, `watched_on`, `rating`, `is_rewatch`,
`review_excerpt`, and optional `episodes` containing exact episode items.
A compact group covers episodes of the same series and season logged in one
agent operation. Legacy episode events group by their stored watch timestamp.
Ungrouped reads return a separate event per episode.
Range endpoints are null for gaps. Reuse the opaque cursor with the same
filters. Legacy diary entries have ratings only where an exact dated rating
is available. Group totals are for the filtered representation.

Taste counts distinct titles and watched episode coordinates. Series without a
title rating can contribute an average from their latest rated episode events.
The histogram counts current title ratings. Candidates require at least five
distinct rated titles and use seeds with an available score of at least 4.
Previously logged, rated, or partially watched titles are excluded. Unwatched
watchlisted items remain eligible with an explicit flag. Provider data and
private card images are currently omitted.

### Errors

The response includes `error.code`, `error.message`, `error.retryable`,
`error.candidates`, and `meta` when available. Validation failures use 400
(`validation_error`), invalid or revoked tokens 401 (`unauthorized`), and
scopes or list permissions 403 (`forbidden`). Missing identities use 404
(`list_not_found`, `title_not_found`). Conflicts use 409 for
`name_conflict`, `default_list_required`, `nothing_to_mark` and
`idempotency_conflict`. Ambiguous searches return candidates in the normal
response. Invalid ratings and insufficient history use 422
(`invalid_rating`, `insufficient_history`). Throttling uses 429 with a
`Retry-After` header and `error.retry_after`. Service faults use 503
(`temporary_unavailable`).

### Example

Call the MCP tool `search_titles` with
`{"query":"Dune: Part Two","media_type":"movie","year":2024}`.

Use the exact `best_match_id` when `ambiguous` is false. Send
`{"title_id":"movie:693134","rating":4.5,"watched_on":null,"idempotency_key":"<new-key>"}`
to `log_watch`. The receipt confirms the actual event ID, date, rating,
localized title, poster and Kino link.

## Tests

Run web typechecking and tests using the existing package scripts. The
marketplace release and adapter tests run with Python. [Agensi release](../marketplace/agensi/README.md)

Run the connected acceptance suite from the repository root with Docker,
PowerShell 7, Node 22.19+ and Python 3 available.

    pwsh -NoProfile -File apps/web/tests/agent/run-isolated.ps1

The runner uses disposable PostgreSQL 17 and PostgREST containers, makes
PostgREST available only on localhost, and injects TMDB catalog fixtures.
The suite runs the previous HTTP adapter scenarios and verifies the new OAuth
workflow. It uses a fixture Supabase Auth endpoint for sign-in, a loopback
HTTP MCP listener, and real PostgreSQL and PostgREST for roles, permissions,
committed writes, and token lifecycle.
