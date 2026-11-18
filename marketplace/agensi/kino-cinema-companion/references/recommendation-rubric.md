# Recommendation rubric

## Evidence tiers

- **Strong match:** at least two independent, explicit signals from the user's data or current request support the title (for example, repeatedly high ratings for a genre plus a matching mood/theme). State the signals.
- **Probable match:** one useful signal or a small/patchy history supports it. Say what is inferred and what remains unknown.
- **Exploratory discovery:** intentionally broadens genre, country, decade, language, or format. Explain the specific axis of variety and why it may be worthwhile.

These are editorial categories, not predicted probabilities. Never invent confidence percentages or imply a trained recommendation model exists.

## Selection order

1. Apply hard constraints: movie/TV, runtime, language, content boundaries, availability region (only when requested and verified), and explicit exclusions.
2. Remove already watched works by stable ID, then exact title + type; retain uncertain same-title cases for clarification. A requested rewatch is the only ordinary override.
3. Look for repeated preference signals in ratings and notes. Weight repeated high and low ratings more than one isolated rating; do not assume a rating scale without evidence.
4. Match candidate evidence to genre, mood, theme, pace, period, country/language, and runtime only when those facts are confirmed.
5. Curate a useful set rather than a repetitive ranked dump. Unless the user specifies otherwise, vary at least one of genre, country, decade, or movie/series format in a list of four or more.
6. Explain each choice in one or two sentences and state any material tradeoff or uncertainty.

## Evaluation method

For each representative history, check: (a) every watched ID/title is excluded, (b) each match reason traces to an input preference or verified candidate fact, (c) no unsupported date/rating/runtime/availability appears, (d) the requested mood and hard constraints are met, (e) tiers are used consistently, and (f) a four-plus title list respects diversity. A reviewer can mark each item pass/fail and record the evidence. Do not judge solely on whether a user agrees with taste; judge traceability, constraint handling, factuality, and variety.
