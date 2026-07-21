
# Analytics, Plans & Admin Controls Foundation

Purely additive — no changes to existing marketplace flows, tables, UI, or auth. Existing `ci_events` / `ci_daily_stats` / `search_events` telemetry stays as-is; this layers external analytics + monetization scaffolding on top.

## Part 1 — Analytics Tracking

**GA4** (ID `G-7M59V1QNZS`, hardcoded — publishable):
- Inject GA4 gtag snippet via `<script>` tags in `src/routes/__root.tsx` head, using `async` so it doesn't block render.
- Send SPA `page_view` on router location changes.

**Meta Pixel** (ID deferred):
- Add `VITE_META_PIXEL_ID` env var; loader is a no-op until set. User can add it later without a redeploy of logic.

**Unified tracker** `src/lib/analytics.ts`:
- `track(event, params)` — fans out to `gtag('event', …)` and `fbq('trackCustom', …)` if loaded.
- Wraps standard Meta events where they map (`PageView`, `CompleteRegistration`, `ViewContent`, `Search`, `Contact`).
- Silent no-op in SSR / when scripts aren't loaded.

**Event wiring** (single-line calls at existing call sites; no logic changes):

| Event | Where |
|---|---|
| `account_created` | `auth.tsx` after successful signup |
| `login_completed` | `auth.tsx` after signin |
| `profile_completed` | `profile.tsx` on save |
| `listing_created` | `post.tsx` after insert |
| `listing_viewed` | `listing.$id.tsx` mount |
| `listing_shared` | `ShareMenu.tsx` |
| `listing_saved` | favourite toggle |
| `seller_contacted` | message thread create |
| `search_performed` | `browse.tsx` / `SearchBar` |
| `category_viewed` | `browse.tsx` when category filter set |

Params captured: `category`, `parish`, `device` (mobile/desktop from viewport), `user_type` (buyer if no listings, seller otherwise, from profile), timestamp auto by GA.

## Part 2 — Admin Analytics Dashboard

New component `src/components/AnalyticsPanel.tsx`, added as a new tab in `/admin` alongside existing Insights/Audience/etc. Reads from **existing** tables via `supabase.rpc` / selects:

- **Users**: count `profiles`; new today/week from `created_at`; active from `last_active_at`.
- **Marketplace**: total `listings`; new today; group by `category_id`; top viewed (order by `views`).
- **Engagement**: counts from `messages`, `share_visits`/`ci_events`, `favourites`, `search_events`.
- **Growth charts**: bucket `profiles.created_at` and `listings.created_at` by day for last 30d; render with a lightweight inline SVG (no new chart lib — matches existing Insights panel style).

Queries batched via TanStack Query; admin-only via existing `useIsModerator` guard.

## Part 3 — Plan & Featured Foundation (backend only, inactive)

Migration adds NEW tables + nullable columns (existing rows unaffected, defaults keep everyone Free):

```sql
CREATE TYPE public.seller_plan AS ENUM ('free','premium','business');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan seller_plan NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',   -- active|cancelled|expired
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);
-- GRANTs (authenticated select-own, service_role all) + RLS: users read own, admin manages.

CREATE TABLE public.plan_settings (
  plan seller_plan PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  price_bbd_cents integer NOT NULL DEFAULT 0,
  featured_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz DEFAULT now()
);
-- Seed: free (enabled, $0), premium (disabled, $15 BBD, 7d), business (disabled, $50 BBD, 7d).
-- GRANTs: anon+authenticated SELECT (public read); admin write via has_role check.

ALTER TABLE public.listings
  ADD COLUMN featured_until timestamptz,   -- null = not featured
  ADD COLUMN is_featured boolean GENERATED ALWAYS AS (featured_until > now()) STORED;
```

No frontend changes to listing display yet — surfacing "featured" visually is future work. Existing seller/buyer flows keep working exactly as today.

## Part 4 — Admin Marketplace Controls

New panel `src/components/MarketplaceControlsPanel.tsx` (Admin tab):
- Toggle `plan_settings.enabled` per plan (Premium / Business).
- Edit `price_bbd_cents` and `featured_days`.
- Toggle a global "featured listings enabled" flag (stored in `plan_settings` for `business`/`premium`).
- Read-only summary counts (users on each plan, currently featured listings).

All writes via a new `createServerFn` in `src/lib/plans.functions.ts` guarded by `has_role(auth.uid(),'admin')`.

## Files touched

**New**: `src/lib/analytics.ts`, `src/components/AnalyticsPanel.tsx`, `src/components/MarketplaceControlsPanel.tsx`, `src/lib/plans.functions.ts`, one migration.

**Additive edits** (single-line tracker calls + nav tab + head scripts): `src/routes/__root.tsx`, `src/routes/auth.tsx`, `src/routes/_authenticated/post.tsx`, `src/routes/_authenticated/profile.tsx`, `src/routes/listing.$id.tsx`, `src/routes/browse.tsx`, `src/components/ShareMenu.tsx`, `src/routes/_authenticated/admin.tsx`, `.env` (add `VITE_META_PIXEL_ID` placeholder).

**Not touched**: any existing DB column semantics, RLS on existing tables, auth flow, listing/messaging/upload/search logic, UI layouts.
