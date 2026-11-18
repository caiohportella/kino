# Data schema

## Accepted source fields

The normalizer accepts CSV rows or a JSON array / object containing an `entries` array (a single entry object is also accepted). Keys are case-insensitive; spaces, hyphens, and underscores are ignored for aliases.

| Canonical field | Common aliases | Meaning |
| --- | --- | --- |
| `title` | `name`, `movie`, `show`, `film` | Required display title |
| `media_type` | `type`, `media`, `kind` | `movie` or `tv` / `series` / `show` |
| `year` | `release_year`, `year` | Optional four-digit release year |
| `watched_at` | `date`, `watch_date`, `watched`, `viewed_at` | Optional date string, preserved as supplied |
| `rating` | `user_rating`, `stars`, `score` | Optional numeric value, preserved if parseable; range is not assumed |
| `id` | `tmdb_id`, `imdb_id`, `identifier`, `external_id` | Optional identifier and source |
| `season` | `season_number` | Optional season coordinate |
| `episode` | `episode_number` | Optional episode coordinate |
| `notes` | `review`, `review_text`, `comment` | Optional user text |
| `watch_type` | `rewatch`, `is_rewatch` | Optional first watch / rewatch indicator |

Unknown input columns remain under `source_fields` to reduce data loss. Empty values become JSON `null`. Dates are not silently reformatted. Ratings are not rescaled; a source's rating scale should be recorded by the user if comparisons are needed.

## Output

The JSON object contains `schema_version`, `entries`, and `issues`. Each accepted entry has `title`, normalized `media_type`, optional `year`, `watched_at`, numeric-or-null `rating`, `identifier` (`value` and inferred `source` when possible), optional season/episode, `notes`, `watch_type`, `source_row`, `source_fields`, and a `duplicate_of` index or `null`.

Duplicate detection is conservative: same explicit identifier + media type, or same case-folded title + media type + year + watch date + episode coordinates. Missing date/year makes title-only rows non-duplicates. Multiple dated rewatches remain distinct. Duplicate entries remain in output and point to the first matching entry; nothing is discarded.

Malformed records appear in `issues` with row/index and reason. An invalid required title or media type is not converted into an entry. The utility never resolves metadata or enriches missing fields.
