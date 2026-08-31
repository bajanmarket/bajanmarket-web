# Phase 1 — Audit: Buyer Intent + Listing Matching foundation

No code or database changes were made. Findings first, implementation only after approval.

## What already exists

**Auth & accounts** — Single account type (no separate buyer/seller records). Session via `src/lib/useAuth.tsx`; protected pages live under `src/routes/_authenticated/`. Roles in `user_roles` + `has_role()`. Sellers are just users who post; `profiles` holds display name, parish, avatar, `banned_at` (hidden from public reads).

**Listings** — `listings`: seller_id, category_id, title, description, price, currency, negotiable, condition (enum), parish (enum), status (enum), views, favourite_count, cover_image_url, featured_until, created_at. Photos in `listing_images`. No structured attributes (brand/model/year) anywhere — free text only.

**Categories** — `categories` (slug, name, icon, sort_order, active). Services use a separate `service_categories` + `service_listings` tree.

**Search** — Client-side query in `src/routes/browse.tsx`: plain Supabase `ilike` on title + filters (category, parish, price min/max, sort). Also `category.$slug` and `category.$slug.$parish` routes. No full-text index, no ranking.

**Existing buyer-activity capture**
- `search_events` (query, parish, category_slug, result_count, user_id) written by `src/lib/logSearchEvent.ts`, rate-limited by a trigger. Used by the admin Insights panel.
- `favourites` (user_id, listing_id, created_at).
- `conversations` (buyer_id, seller_id, listing_id) — the "contacted seller" signal.
- `listings.views` counter via `increment_listing_view` RPC — aggregate only, **not per-user**, so "recently viewed by this buyer" does not exist today.
- `ci_events` — a generic event table with `ci_log_event()`; present in the schema but not called anywhere in app code.
- GA4/Meta pixel in `src/lib/analytics.ts` (external only, not queryable).

**Location** — Parish enum only (11 parishes). No lat/long, no distance. "4 km away" is not currently possible; parish match / neighbouring-parish is.

**Feature flags** — `platform_feature_flags` (key, enabled) already exists with admin toggles in the Payments panel. Directly reusable.

**Existing AI** — Lovable AI Gateway (Gemini) used for listing autofill and the Seller Growth agent, all server-side in `*.server.ts`. No embeddings, and **pgvector is not installed** (extensions: pgcrypto, pg_cron, pg_net, pgmq, uuid-ossp).

**Notifications** — `notifications` + `notification_preferences` + bell UI exist, so seller demand alerts are feasible later.

## What can be reused (no duplication)

- `search_events` as the primary intent signal — read it, don't re-log searches.
- `favourites` and `conversations` as save/contact signals.
- `categories`, `listings`, `ListingCard`, `AppShell`, existing design tokens.
- `platform_feature_flags` for the kill switch.
- `createServerFn` + `requireSupabaseAuth` pattern for all scoring (never the browser).
- `notifications` infra for the future seller-demand feature.

## What must be added (minimum)

1. `buyer_activity_events` — the one genuinely missing signal is **per-user listing views**. Table: user_id, event_type (`listing_viewed` | `seller_contacted` | `listing_saved`), listing_id, category_id, occurred_at. Searches keep flowing to `search_events`; this table covers the rest. RLS: insert/select own rows only; admins via `has_role`.
2. `buyer_intents` — user_id, category_id, normalized_query, keywords[], min_price, max_price, preferred_condition, preferred_parish, attributes jsonb, intent_score, first_seen, last_seen, active. Unique-ish per (user_id, normalized intent) so repeat searches **strengthen** an existing row rather than creating new ones. RLS: owner-only read/write; no public exposure.
3. Both tables additive, indexed on (user_id, last_seen) and (category_id, active), with GRANTs, RLS enabled, no changes to existing tables or policies.

Not added: `listing_matches` (a materialised table is premature — scoring on demand for one buyer's top intents is cheap). Not added: pgvector/embeddings.

## Files that would change

| File | Change |
| --- | --- |
| `src/lib/matching/weights.ts` (new) | All tunable weights + thresholds in one place |
| `src/lib/matching/score.ts` (new) | Pure `calculateListingMatch(intent, listing)` → scores + `match_reasons`; unit-testable, no I/O |
| `src/lib/matching/intent.ts` (new) | Query normalisation, keyword extraction, price/condition hints, intent merging, recency decay |
| `src/lib/matching.functions.ts` (new) | `recordActivity`, `getMyIntents`, `getRecommendations` server fns behind `requireSupabaseAuth` |
| `src/components/RecommendedForYou.tsx` (new) | Renders existing `ListingCard`s; returns `null` when flag off, data thin, or the call fails |
| `src/lib/logSearchEvent.ts` | Additive: after logging, fire-and-forget intent upsert. Existing behaviour untouched |
| `src/routes/listing.$id.tsx` | Additive fire-and-forget `listing_viewed` next to the existing view RPC |
| `src/routes/index.tsx` / `browse.tsx` | Mount `<RecommendedForYou />` above existing content; nothing else touched |
| Migration | Two new tables + RLS + GRANTs + indexes + `buyer_matching_enabled` flag row |

## Risks

- **Silent-failure discipline** — every new call must be fire-and-forget and try/caught, or a matching bug becomes a marketplace bug. The recommendations component fails to `null`, never an error boundary.
- `search_events` has a rate-limit trigger; intent writes must not trip it (server-side, debounced).
- Free-text titles mean keyword matching only; no brand/model precision until structured attributes exist. Reasons will say "matches your search for X", not fake precision.
- Parish-level location only — reasons must say "in your parish"/"nearby parish", never a fake distance.
- Privacy: intents are owner-only. Seller-side demand stays unbuilt this phase; only aggregate counts later.
- Scale: recommendations query = top 3 active intents × ≤200 candidate listings pre-filtered by category/price/status in SQL, scored in memory, cached by React Query. No cross-join.

## Smallest safe implementation plan

- **Phase 2** — migration (2 tables, RLS, GRANTs, indexes, feature flag row, default off).
- **Phase 3** — pure scoring modules + centralised weights + vitest cases for scenarios A–C.
- **Phase 4** — capture hooks (search → intent, listing view, save, contact) — writes only, no UI.
- **Phase 5** — `RecommendedForYou` behind the flag, shown only when the buyer has ≥1 intent scoring above threshold; otherwise renders nothing.
- **Phase 6** — verify scenarios D (new user) and E (engine disabled/failing) leave browse, search and home identical.

Approve and I'll start at Phase 2.
