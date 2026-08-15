# Upstash Redis Search Backend Design

**Date:** 2026-08-13

## Goal

Make Upstash Redis Search Kino's primary indexed search backend while preserving the existing search gateway, normalized Kino result contracts, localization, autocomplete presentation, keyboard behavior, animations, routing, and visual design.

This change is limited to the web search boundary and its server-side indexing/synchronization infrastructure. Existing dirty-worktree changes outside that scope are user-owned and must remain untouched.

## Current repository context

Kino already has a shared search architecture:

```text
GlobalSearch / search page
  -> same-origin search client
  -> /api/v1/search
  -> apps/web/lib/search/gateway.ts
  -> @kino/core/search normalization, fusion, ranking, grouping
  -> web presentation helpers
```

The current dirty worktree contains an incomplete standalone `@upstash/search` adapter with title and user indexers. The requested implementation must replace that adapter with `@upstash/redis` Redis Search. The existing gateway and UI are reusable and should remain the integration boundary.

Kino's canonical media types are `movie` and `tv` in TMDb/core models and `movie` and `series` in the search contract. The mapper at the search boundary will remain the single place that converts `tv` to `series`.

Kino's configured languages are `en-GB`, `pt-BR`, `fr-FR`, `it-IT`, `nb-NO`, `es-ES`, and `de-DE`. Search aliases and display localization are separate: aliases improve matching, while the existing TMDb presentation path continues selecting the title shown in the current Kino language.

## Official Upstash constraints

The implementation follows the official Redis Search documentation discovered through `https://upstash.com/docs/llms.txt`:

- Use `@upstash/redis`, not the standalone `@upstash/search` product.
- Create JSON indexes once with `redis.search.createIndex(...)`; use `existsOk: true` for rerunnable setup and `redis.search.index(...)` for request-time clients.
- Store documents with normal Redis JSON operations. Indexes track matching prefixes automatically.
- Use `$smart`/implicit smart matching, `$fuzzy`, `$should`, and `$boost` through JSON filters.
- Use `.noStem()` for proper names and `.noTokenize()`/`s.keyword()` for identifiers and exact values as appropriate.
- Writes are asynchronous. Do not call `waitIndexing()` on every production write; use it only in setup, backfill, and integration-test flows where read-your-own-write behavior is required.
- Use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` server-side only.

## Architecture

### Backend boundary

Keep the existing `/api/v1/search` route, `createSearchGateway`, `@kino/core/search` pipeline, response versions, and web presentation adapters. Replace the current vector/standalone-search provider implementation with a Redis Search provider that returns the existing `SearchProviderResult` shape.

The unified Redis index is queried in parallel for title and people candidates by one indexed provider, and the same handle serves the user-provider slot. Upstash-specific keys, scores, filters, and document shapes do not cross into React components.

### Indexes and key prefixes

| Index | Redis key prefixes | Contents |
| --- | --- | --- |
| `kino-search` | `kino:search:title:`, `kino:search:person:`, `kino:search:user:` | Movies, series, people, and public Kino users |

The unified index uses `dataType: "json"`. Title, person, and user queries apply `entityType` filters inside Redis Search.

Setup lists indexes with `SEARCH.LISTINDEXES`, drops only the known legacy Kino index names (`kino-titles`, `kino-people`, `kino-users`), and then creates `kino-search` with `existsOk: true`. Dropping a search index does not delete the underlying JSON keys.

### Documents

Title documents are derived from existing TMDb, `TitleDetails`, `PersistedTitle`, and localized-title data. The stable identity is `mediaType + tmdbId`; a movie and series with the same numeric TMDb ID must remain distinct. Searchable fields include the canonical title, original title, configured localized aliases, and small ranking/display fields such as release year, popularity, vote average, vote count, poster, backdrop, and update time.

Person documents contain TMDb ID, name, known-for department, popularity, and profile path. Large `known_for` payloads are not indexed.

User documents contain only public searchable profile data: user ID, username, display name, avatar URL, and bio. Email, auth metadata, private settings, and secrets are excluded.

### Schema behavior

- Names and title aliases use tokenized text with `.noStem()` so multi-word names remain searchable without stemming proper nouns.
- Usernames and stable identifiers use exact keyword/no-tokenize behavior where the query requires an intact value.
- Numeric fields use numeric schema types; FAST fields are used only for meaningful sorting or score functions.

## Search behavior and ranking

Redis queries use documented lexical search operators:

- smart matching for normal terms and multi-word input;
- fuzzy prefix matching for autocomplete and small typos;
- `$should` to combine canonical, original, localized, and weaker match clauses;
- `$boost` to favor title/name fields and exact/prefix clauses.

The provider returns a bounded candidate set. A deterministic server-side scorer then enforces Kino's ranking order:

```text
exact match
> normalized exact match
> prefix/word-prefix match
> smart match
> small typo/fuzzy match
> weak fuzzy match
> bounded popularity/vote tie-breakers
```

Popularity and vote counts cannot override a clearly better textual match. Existing Kino fusion/deduplication remains responsible for combining Redis and TMDb sources. Identities are deduplicated by `movie|series + TMDb ID`, `person + TMDb ID`, and `user + Kino user ID`.

## TMDb fallback and self-growing index

Redis is primary when it returns enough relevant candidates for the current mode and result limit. It is not called alongside TMDb unconditionally.

TMDb search runs only when Redis is unconfigured, unavailable, empty, or below the existing gateway's conservative sufficiency threshold. The threshold is mode-aware and does not treat one missing result as an automatic fallback trigger. TMDb results are normalized through the existing TMDb provider, merged with Redis candidates, and deduplicated before the shared Kino pipeline ranks them.

Useful fallback titles and people are indexed asynchronously as a best-effort operation. Indexing failure is logged/observed but never fails the user's valid TMDb response. No production request waits for indexing completion.

## Synchronization and backfill

Index creation is explicit and rerunnable through a setup command. Backfill commands read canonical Supabase data in bounded pages, write Redis JSON documents in batches, report progress, and tolerate individual document failures without exposing credentials.

Required commands:

- setup/create indexes;
- backfill persisted titles;
- backfill public users;
- targeted title/person/user reindex helpers.

People are not backfilled from TMDb globally because Kino has no meaningful persisted people dataset; they are indexed from useful TMDb search results and explicit targeted reindex operations.

Existing web title persistence is connected through a server-side synchronization boundary so Redis credentials remain private. Existing profile creation/update/delete flows use a reusable server indexing service. Canonical Supabase operations remain authoritative and succeed even if Redis is unavailable.

## Localization and autocomplete

Localized aliases are indexed from Kino's configured locale model and existing localized-title/TMDb translation data where available. Search matching language is independent of display language. The existing TMDb `resolvePresentation` path continues to render the title according to the selected Kino locale, including Brazilian Portuguese (`pt-BR`).

The existing `GlobalSearch` ghost-completion helper remains the source of completion behavior. It may use the strongest normalized title result only when the result is a literal textual continuation of the current input. A fuzzy correction such as `godfahter` must not create an invalid ghost suffix. Existing cursor synchronization, Tab/ArrowRight acceptance, and keyboard navigation remain unchanged.

## Resilience and observability

The server distinguishes unconfigured Redis, Redis failures, and valid zero-result searches. The existing gateway fallback/error contract remains intact. Development observability records query-safe counts and durations for Redis hits, fallback usage, TMDb result counts, merged counts, and indexing failures without logging secrets or sensitive profile data.

## Testing and quality gates

Infrastructure-boundary tests mock Redis, TMDb, and Supabase. Coverage includes:

- title, series, person, and user normalization;
- exact/prefix/fuzzy ranking and popularity tie-breaking;
- Redis/TMDb deduplication, including movie-vs-series same-ID separation;
- localized aliases and selected-locale display, including `pt-BR`;
- sufficient Redis results avoiding TMDb;
- insufficient Redis results and Redis failures invoking fallback;
- fallback indexing failures not failing search;
- index setup idempotence and batched backfill behavior;
- valid ghost completion and no fuzzy-only ghost completion;
- stale request cancellation through the existing React Query boundary.

Run the repository's relevant checks:

```text
pnpm biome check .
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
```

No unrelated native/mobile files will be modified for this web-only migration.
