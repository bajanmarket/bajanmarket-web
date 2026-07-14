
# Commerce Intelligence Module — Plan

A completely additive module. No existing tables, routes, components, or APIs are renamed or removed. All new work lives under new files, new routes, and new tables. Existing marketplace flows (listings, messaging, auth, admin, campaigns emails, sharing) keep working unchanged.

## Codebase analysis (what already exists)

Relevant existing surfaces that this module will read from but not modify:
- `listings`, `listing_images`, `favourites`, `messages`, `conversations`, `profiles`, `businesses`, `business_reviews`, `categories`, `search_events`, `share_visits`, `user_roles`, `campaigns` (email campaigns), `campaign_sends`.
- Existing `campaigns` table is for email marketing (already used by `/campaigns` admin). It is NOT the same as marketing‑attribution campaigns in this spec — to avoid breaking the existing feature we introduce a new `attribution_campaigns` table instead of overloading `campaigns`.
- `share_visits` already captures UTM inbound clicks — we will read from it (no schema change) and augment with richer per‑seller attribution.
- `search_events` already exists — Module 3 will read from it.
- No `orders` table exists today (marketplace is lead‑gen via messaging). Revenue/orders metrics will be driven by a new opt‑in `ci_orders` table sellers can log manually, plus a "message → sale" conversion flag. This matches the spec while being honest about the current model.

## Design principles

- Event‑sourced: one append‑only table `ci_events` receives all instrumentation. Aggregations are computed by SQL views + scheduled rollups into `ci_daily_stats`, `ci_listing_stats`, `ci_category_stats`, `ci_campaign_stats`.
- Layered:
  - Repository: thin server functions in `src/lib/ci/*.functions.ts` that only query CI tables.
  - Service: business logic (trust score calc, ROI, attribution join) in `src/lib/ci/*.service.ts`.
  - API: `createServerFn` wrappers + a public tracking route `/api/public/ci/track` and `/api/public/ci/c/$code` (campaign redirect).
  - UI: new routes under `_authenticated/bi/*`, self‑contained components in `src/components/ci/*`.
- Zero coupling: no existing file's business logic changes. The only edits are:
  - `TopHeader.tsx` / `BottomNav.tsx` (or a new nav entry in profile menu) — add a "Business Intelligence" link, gated to users who own a business OR have ≥1 listing OR are admin. Purely additive JSX.
  - `src/routes/__root.tsx` — one call to a new `useCiPageview()` hook that emits a `PageViewed` event. Guarded, non‑blocking.
  - `src/routes/listing.$id.tsx`, `seller.$id.tsx`, `business.$slug.tsx` — one extra `emitEvent('ListingViewed'|'SellerProfileViewed', …)` call in an existing effect. No behavior change.
  - `src/components/ShareMenu.tsx` — emit `ListingShared` event alongside existing share.
  - `src/routes/_authenticated/messages.$id.tsx` — emit `MessageSent` on send (already logs to DB; we add one line).
  - Trust Score badge on `seller.$id.tsx` and `business.$slug.tsx` — additive component, no layout rewrite.

If any of the above edits look risky at implementation time, I fall back to a DB trigger on the existing table (e.g. `AFTER INSERT ON messages`) so no application code changes at all.

## New database tables (all new, RLS on, GRANTs included)

1. `ci_events` — append‑only event log
   `id, occurred_at, event_type, actor_id (nullable), seller_id (nullable), listing_id (nullable), business_id (nullable), category_id (nullable), campaign_id (nullable), session_id, source, medium, campaign_code, referrer, path, parish, device, browser, metadata jsonb`
   Indexed on `(seller_id, occurred_at)`, `(listing_id, occurred_at)`, `(campaign_id, occurred_at)`, `(event_type, occurred_at)`.
2. `attribution_campaigns` — seller‑generated tracking campaigns
   `id, seller_id, code (unique short slug), name, channel, destination_path, cost_cents, notes, created_at, archived_at`.
3. `ci_orders` — optional seller‑logged sales (drives Revenue/AOV/ROI)
   `id, seller_id, listing_id, buyer_id (nullable), conversation_id (nullable), amount_cents, currency, status, sold_at, attribution_campaign_id (nullable), notes`.
4. `ci_daily_stats` — per‑seller per‑day rollup
   `seller_id, day, views, messages, shares, favourites, orders, revenue_cents, unique_visitors`.
5. `ci_listing_stats` — per‑listing rollup (views, messages, shares, favourites, time‑to‑sale, first_sold_at).
6. `ci_category_stats` — market intelligence per category (avg price, avg time to sell, active inventory, trending score).
7. `ci_trust_scores` — cached score per seller (score, breakdown jsonb, computed_at).

All tables:
- `service_role` full access.
- `authenticated`: SELECT scoped to `auth.uid() = seller_id` (owner reads own data) plus admin‑read via `has_role('admin')`.
- `anon`: no direct access. Public tracking uses a SECURITY DEFINER RPC `ci_log_event(...)` (rate‑limited like `log_share_visit`).
- Executive dashboard uses `has_role('admin')` policy on aggregates only; no PII exposed cross‑seller.

Existing tables: unchanged. Existing `campaigns` (email) table untouched.

## Background jobs (pg_cron)

- `ci_rollup_daily` — every 15 min: upsert last‑48h into `ci_daily_stats`, `ci_listing_stats`.
- `ci_rollup_market` — hourly: refresh `ci_category_stats`.
- `ci_rollup_trust` — every 6h: recompute `ci_trust_scores`.
Runs via `pg_net` → `/api/public/ci/rollup` protected by `apikey` header (anon key), matching existing cron patterns.

## New files

Routes (all new):
- `src/routes/_authenticated/bi/route.tsx` — layout + gate (must own business or have ≥1 listing OR be admin).
- `bi/index.tsx` — Module 1 dashboard.
- `bi/campaigns.tsx` — Module 2 attribution (list + create + per‑campaign detail).
- `bi/campaigns.$id.tsx`.
- `bi/insights.tsx` — Module 3 market intelligence.
- `bi/trust.tsx` — Module 4 breakdown for current seller.
- `bi/reports.tsx` — CSV export screen.
- `src/routes/_authenticated/admin.executive.tsx` — Module 5 (admin‑gated via existing `useIsModerator`/`has_role('admin')`).
- `src/routes/api/public/ci/track.ts` — POST beacon endpoint (rate‑limited).
- `src/routes/api/public/ci/c.$code.ts` — 302 redirect + logs `CampaignVisited`.
- `src/routes/api/public/ci/rollup.ts` — cron target.

Server functions / services:
- `src/lib/ci/events.functions.ts` — `emitEvent`, `logPageview`.
- `src/lib/ci/dashboard.functions.ts` — seller KPIs (uses `requireSupabaseAuth`).
- `src/lib/ci/attribution.functions.ts` — campaigns CRUD, ROI.
- `src/lib/ci/market.functions.ts` — category/market insights.
- `src/lib/ci/trust.functions.ts` — trust score compute + read.
- `src/lib/ci/executive.functions.ts` — admin KPIs (role check inside handler).
- `src/lib/ci/orders.functions.ts` — CRUD for `ci_orders`.
- `src/lib/ci/rollup.server.ts` — rollup SQL (called by cron endpoint).

UI components:
- `src/components/ci/KpiCard.tsx`, `LineChart.tsx`, `BarChart.tsx`, `Sparkline.tsx` (recharts — already common in shadcn stack; will `bun add recharts` if not present).
- `src/components/ci/CampaignForm.tsx`, `CampaignRow.tsx`, `CampaignQr.tsx` (QR via `qrcode` package).
- `src/components/ci/TrustBadge.tsx`, `TrustBreakdown.tsx`.
- `src/components/ci/OrderLogDialog.tsx` (seller logs a completed sale, optionally from a conversation).

Hook: `src/lib/ci/useCiTracking.ts` — client-side `sendBeacon` to `/api/public/ci/track`, session id in `sessionStorage`, UTM parsing, respects existing `share_visits` flow (no double‑count: `share_visits` stays as is; CI reads it as one of its sources).

## Files modified (minimal, additive)

| File | Change | Why |
|---|---|---|
| `src/components/TopHeader.tsx` | Add "Business Intelligence" link when eligible | Nav entry per spec |
| `src/routes/_authenticated/profile.tsx` | Add BI shortcut card | Discoverability, does not touch existing fields |
| `src/routes/__root.tsx` | Add `useCiTracking()` call in root effect (guarded) | Emit PageViewed |
| `src/routes/listing.$id.tsx` | Add `emitEvent('ListingViewed')` in the existing view-increment effect; render `<TrustBadge sellerId=…>` next to seller name | Instrumentation + trust display |
| `src/routes/seller.$id.tsx` | Render `<TrustBadge>` + emit `SellerProfileViewed` | Trust surface |
| `src/routes/business.$slug.tsx` | Render `<TrustBadge>` | Trust surface |
| `src/components/ShareMenu.tsx` | Emit `ListingShared` | Attribution |
| `src/routes/_authenticated/messages.$id.tsx` | Emit `MessageSent`; add "Mark sale" button opening `OrderLogDialog` | Message→sale conversion metric |
| `src/routes/_authenticated/admin.tsx` | Add "Executive" tab linking to `/admin/executive` | Admin discoverability |

Every edit is 1–5 lines; no existing logic is rewritten. If a diff turns out larger, I will stop and revisit.

## Security

- All new tables RLS‑enabled, seller‑scoped policies via `auth.uid() = seller_id`.
- Executive dashboard fns check `has_role('admin')` inside handler (never client‑side).
- Public track endpoint: rate‑limit per session_id + IP hash, drop payload fields > length caps, no PII in event metadata.
- Attribution redirect endpoint validates `code` against `attribution_campaigns` and only 302s to same‑origin destinations.
- Sellers can only CRUD their own `attribution_campaigns` and `ci_orders`.

## Performance

- `ci_events` is write‑heavy, read via rollup tables only.
- Indexes listed above; partial index `WHERE occurred_at > now() - interval '90 days'` for hot reads.
- All BI routes lazy‑load charts; queries paginated (50/page).
- Rollup jobs shard by seller_id modulo when volume warrants (future).
- Tracking beacon uses `navigator.sendBeacon` — never blocks navigation.

## Risk assessment / breaking‑change check

- No existing table altered.
- Name collision: existing `campaigns` (email) stays; new table is `attribution_campaigns`.
- Existing `share_visits` stays as source of truth for share UTM; CI reads it, does not migrate it.
- Existing `search_events` reused read‑only for Module 3.
- Trust badge is a small additive element; if layout regresses on any page I will remove it and render on a dedicated section.
- No changes to auth, messaging send, payments, notifications, or admin moderation flows.

## Rollout order

1. Migration: create all new tables + RPC + indexes + policies + GRANTs.
2. Cron: schedule rollup job (via `supabase--insert`, per cron guide).
3. Server fns + tracking route + redirect route.
4. BI routes shell + Dashboard (Module 1).
5. Attribution (Module 2) incl. QR + redirect.
6. Market Insights (Module 3).
7. Trust Score compute + badge (Module 4).
8. Executive Dashboard (Module 5).
9. Minimal edits to existing files for instrumentation + nav entry.
10. Reports (CSV export).

Approve this plan and I'll start with the migration.
