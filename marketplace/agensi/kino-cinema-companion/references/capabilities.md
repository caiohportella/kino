# Standalone capabilities

For authenticated Kino operations, see `references/kino-integration.md`.

| Workflow | Inputs | Result | Boundary |
| --- | --- | --- | --- |
| Discovery | Mood, genres, themes, constraints, optional history | Evidence-labeled shortlist | Requires candidate evidence; availability is region- and date-dependent |
| Watchlist | Titles, types, categories, priorities, visibility labels | Deduplicated editable list | Labels do not alter remote permissions |
| History import | User-provided CSV/JSON or pasted rows | Normalized JSON and issue report | No automatic import into Kino or another service |
| Viewing analysis | Diary entries, ratings, dates, genres | Sample-aware summary | Missing metadata limits comparisons |
| Diary | User-confirmed date, rating, notes, rewatch | Structured viewing record | Does not write to a remote account |
| TV progress | Confirmed watched episodes and episode order | Gaps and next known unwatched episode | No guessing from previous episode completion |

Standalone workflows use supplied data and produce local artifacts. To operate on your Kino account, use the connected workflow in `references/kino-integration.md`.
