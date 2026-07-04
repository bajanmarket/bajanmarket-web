## Demand insights (admin-only)

Add an admin **Insights** tab that surfaces what buyers want, plus start logging search queries so you can see demand that has no matching listing yet.

### What you'll see

At `/admin` (new "Insights" tab, moderator/admin only):

- **Top searches (last 7 / 30 days)** — query text, count, and how many active listings match. Rows with 0 matches are highlighted — that's unmet demand.
- **Top categories** by views, favourites, and messages started (last 7 / 30 days).
- **Top parishes** by listing activity.
- **Trending listings** — most views + favourites + messages in the last 7 days.
- **Zero-result searches** — a focused list of searches that returned nothing.

### Technical section

**New table `search_events`** (append-only log, admin-read):
- `id uuid`, `created_at timestamptz`
- `query text` (lowercased, trimmed), `parish parish null`, `category_slug text null`
- `result_count int` (rows returned)
- `user_id uuid null` (nullable — anonymous searches allowed)
- RLS: INSERT allowed for `anon` + `authenticated` (public log); SELECT restricted to admins/moderators via `has_role`
- Indexes on `created_at desc`, `lower(query)`

**Search logging** — `SearchBar.tsx` submit handler and `browse.tsx` query resolution fire a lightweight `insert` into `search_events` (fire-and-forget, no await blocking navigation). Empty queries skipped. Basic client-side debounce so repeat identical submits inside 2s collapse.

**Server functions** (`src/lib/insights.functions.ts`, admin-gated via `requireSupabaseAuth` + `has_role('moderator')` check):
- `getTopSearches({ days, limit })` → grouped by `lower(query)`, joined with a count of matching active listings
- `getZeroResultSearches({ days, limit })`
- `getTopCategories({ days })` → joins listings + views/favourite_count/messages
- `getTopParishes({ days })`
- `getTrendingListings({ days, limit })` → simple score: `views + 3*favourite_count + 5*message_threads`

**Admin UI** — extend `src/routes/_authenticated/admin.tsx` with tabs (Reports | Insights). Insights tab has a 7d/30d toggle and 5 cards using the server fns above via `useSuspenseQuery`.

**No public exposure** — nothing rendered to shoppers or sellers. Search logs are anonymized (user_id optional, no IP).

### Out of scope

- Public "Trending" row on homepage
- Seller-facing demand hints on the post form
- Historical backfill (starts logging from deploy)