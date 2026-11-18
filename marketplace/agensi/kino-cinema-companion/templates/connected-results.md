# Connected Kino results

Use the user's language and format the calendar date using `meta.user.locale`.
Treat `watched_on` as a calendar date. Show “today” only when it equals
`meta.today`. Supply an accessible poster at `w185` if the host can render
Markdown images. In all cases include the linked title as text. Omit absent
posters and ratings. Display a numeric rating and optional stars, e.g. ★★★★½
4.5/5. Escape user-supplied prose for the output format.

## Watchlist receipt

**[{{Title}} ({{year}})]({{title.url}})** · {{movie or series}}\
{{Added to or already in}} **[{{list.name}}]({{list.url}})** · {{visibility}} · {{item_count}} items

For a created list, show its name, visibility, item count and supplied description.
Label a private link as requiring sign-in and access.

## Watch and episode receipt

**[{{Title}}]({{title.url}})** · {{watched_on}} · {{rating when present}}\
{{First watch or rewatch when supported}}. Include the previous viewing date if
returned and useful.

For episodes, show the season and precise episode coordinates with names when
present. Show skipped counts, newly applied rating scope, released progress
and the returned next episode. Use a progress bar only when the total is known
and greater than zero. Show a range only for a contiguous group.

## Diary

Group the returned entries under localized date headings. For each, show title,
rating, rewatch marker, and episode group if present. Use the episode item list
for noncontiguous groups and individual ratings. Show an excerpt only as
plain text. Offer the next page when a cursor exists. Link to `/diary` on the
issuing Kino origin when useful.

## Candidates

For each recommendation show the linked title, year when available, one short
reason tied to the returned seed, and an “In your watchlist” marker when
applicable. Attribute the evidence to the real rating or episode average and
avoid statements about availability. Include the provided TMDB attribution
where catalog metadata is shown.
