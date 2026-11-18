# Demonstration results

## Connected receipt

The following illustrates the layout using test data. In a live interaction,
replace every value with the verified receipt and add the poster when provided.

**[Dune: Part Two (2024)](https://kino.example/title/693134-dune-part-two?type=movie)**\
Logged on 17 November 2026 · ★★★★½ 4.5/5 · First watch

**[Severance](https://kino.example/title/95396-severance?type=tv)**\
Marked S01E02–S01E05 as watched. S01E01 was already watched.\
Season 1 progress · 5 of 9 released episodes · Up next S01E06

## Standalone examples

These scenarios are deterministic workflow examples. The five-history recommendation scenario uses a supplied candidate sheet so that the rationale can be checked without inventing catalog facts or exposing a personal diary to search. The normalization result was produced by `scripts/normalize_history.py` and the standalone validation suite.

## Scenario A — personalized recommendation

**Request:** “I rated Arrival and Her 5/5, Moon and Ex Machina 4.5/5, and The Truman Show 4/5. I like thoughtful, intimate science fiction, but want an unwatched movie under two hours. From this verified candidate sheet, pick three.”

**Candidate sheet supplied with request:** `After Yang` — movie; 2021; 96 minutes; genres: science fiction, drama; themes: memory, family, technology. `Coherence` — movie; 2013; 89 minutes; genres: science fiction, thriller; themes: identity, alternate realities. `Gattaca` — movie; 1997; 106 minutes; genres: science fiction, drama, thriller; themes: genetic selection, identity. `Arrival` — movie; 2016; 116 minutes.

**Result:**

1. **After Yang — strong match.** It fits the supplied interest in intimate, thoughtful science fiction and the candidate sheet's family, memory, and technology themes. Listed runtime: 96 minutes. The candidate sheet is the source for these details.
2. **Gattaca — probable match.** It stays within science fiction and identity-focused ideas, while shifting toward a more suspenseful tone. Listed runtime: 106 minutes; source: supplied candidate sheet.
3. **Coherence — exploratory discovery.** It adds a compact, more thriller-leaning take on science fiction and alternate realities. Listed runtime: 89 minutes; source: supplied candidate sheet.

**Check:** Arrival was excluded as already watched. The list meets the under-two-hour constraint using only supplied runtimes. No availability or external rating claim was made.

## Scenario B — watchlist organization

**Input:** `Arrival (film)`, `Arrival (movie)`, `The Bear (TV)`, `The Bear (series)`, `Moon (movie)`, `Unknown Title (TV)`.

**Result:**

**Quiet ideas (visibility label: private)**

- **Movies:** Arrival (duplicate rows merged; identity match is exact in supplied data); Moon.
- **TV series:** The Bear (duplicate rows merged; identity match is exact in supplied data); Unknown Title.
- **Unresolved:** Unknown Title has no year or identifier, so no release identity was asserted.
- **Permission note:** “Private” is a label for this exported list only; no platform setting changed.

## Scenario C — TV progress

**Input:** “North Shore” season metadata says season 1 has 8 episodes. Confirmed watched: S1E1, S1E2, S1E3, S1E5.

**Result:**

- **Confirmed watched:** S1E1–S1E3, S1E5 (4 of 8 listed episodes).
- **Known gaps:** S1E4, S1E6–S1E8 are not in the supplied watched set. This does not prove the user has not watched them.
- **Next known unwatched episode:** S1E4 is the first episode absent from the supplied watched set, assuming the season metadata is complete and ordered as supplied.
- **Progress:** 4/8 listed episodes (50% of listed episode count); this is not a claim about the whole series.

## Normalizer sample

`sample-history.csv` produces 5 entries, 0 invalid records, and 0 duplicate markers. Ratings, dates, titles, and types are preserved; notes remain in `source_fields` and `notes`.
