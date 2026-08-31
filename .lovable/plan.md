# BajanMarket — Read-Only Production Readiness & Security Audit

No code, migrations, config, or deployments were changed. Findings are grouped by severity, each marked **Confirmed issue**, **Concern**, or **Working as designed**. Evidence comes from live policy/grant/column-privilege queries against the production database plus a full pass over server functions, routes and components.

Headline: the server-function layer is genuinely solid — every admin action re-derives the caller's role server-side from `user_roles`, both public webhooks verify signatures, MCP tools scope to the caller. The real exposure is at the **database write layer**: several tables let signed-in users update columns the UI never exposes, and the browser Supabase client can reach all of them directly.

---

## Critical

### C1. A banned user can un-ban themselves — Confirmed issue
- Policy `profiles / users or mods update profiles` (UPDATE) allows `auth.uid() = id`, and `authenticated` holds column UPDATE on `profiles.banned_at` (verified: `has_column_privilege('authenticated','public.profiles','banned_at','UPDATE') = true`). No trigger on `profiles` guards the column (only `profiles_updated_at`).
- Banning is implemented as `update profiles set banned_at = ...` in `src/routes/_authenticated/admin.index.tsx:127`, and enforcement everywhere reads it via `public.is_user_banned()` (listing insert policy, message insert policy, `listings`/`listing_images` public-read policies).
- Exploit: a banned user runs one call from the browser console — `supabase.from('profiles').update({ banned_at: null }).eq('id', myId)` — and instantly restores posting, messaging and listing visibility. Moderation is effectively advisory.
- Same policy also lets any user rewrite their own `listings_count`, `favourites_count`, `messages_sent_count`, `first_listing_at`, `last_active_at` — the trust/vanity metrics shown on seller profiles and used by `ci_compute_trust_score`.
- Fix direction (not applied): restrict the self-update to the columns a user should own (column-level GRANT, or a BEFORE UPDATE guard trigger that rejects changes to `banned_at` and counter columns unless the actor is admin/moderator — the same pattern already used well by `businesses_guard_status`).

---

## High

### H1. Message bodies can be rewritten by the recipient — Confirmed issue
- Policy `messages / recipient can mark read` (UPDATE) has `USING` restricted to the non-sender participant but **`WITH CHECK` is null**, and `authenticated` has UPDATE on `messages.body`.
- Exploit: the recipient of a message can silently rewrite the sender's `body` (and `created_at`, `sender_id`) — e.g. change an agreed price, then screenshot it in a dispute. Chat history is not tamper-evident.
- Fix direction: add a `WITH CHECK` limiting the update to `read_at` / `delivered_at`, or restrict column UPDATE grants to those two columns.

### H2. Conversation ownership can be reassigned to a stranger — Confirmed issue
- Policy `conversations / participants update conversation` allows UPDATE where the actor is buyer or seller, `WITH CHECK` re-tests the same. `conversations.seller_id` is updatable by `authenticated`.
- Exploit: a buyer updates `seller_id` on their own conversation to an arbitrary user id (they remain buyer, so the CHECK still passes). The whole thread — including messages already sent — appears in an uninvolved user's inbox, and the original seller loses it. Also usable to inject abusive content into any user's inbox without them ever being contacted.
- Related: `conversations / buyer creates conversation` (INSERT) only checks `auth.uid() = buyer_id`; nothing ties `seller_id` to the referenced `listing_id`'s owner, so threads can be fabricated against any seller.

### H3. Unauthenticated, uncapped AI endpoint — Confirmed issue
- `src/lib/ai-listing.functions.ts:21` `suggestListingFromImage` has no `requireSupabaseAuth` middleware and no rate limit; it accepts an image data URL and calls Gemini billed to `LOVABLE_API_KEY` (`:24`, `:81-88`).
- Exploit: anyone on the internet can POST to the server-function endpoint in a loop and burn AI credits — a direct financial DoS. Highest-value launch blocker after C1.
- Fix direction: add `requireSupabaseAuth`, plus a per-user daily cap persisted in the database.

### H4. Booking times are mutable by either party outside availability rules — Confirmed issue
- `bookings_guard_update()` freezes `reference`, `service_listing_id`, `provider_id`, `buyer_id`, `price`, `currency` and validates status transitions — but **not `starts_at` / `ends_at`** (both updatable by `authenticated`).
- Exploit: a buyer or provider on a `confirmed` booking silently moves the appointment to any time — outside working hours, past blocked dates, double-booked over other confirmed slots — with no status change, no `booking_status_history` entry, and no notification (history only logs status transitions, `log_booking_status_change`). Calendar integrity and the whole reschedule-consent flow are bypassable.

---

## Medium

### M1. Sellers can inflate their own listing metrics — Confirmed issue
- `listings / sellers update own listings` permits the seller to update every column including `views` (`has_column_privilege(... 'views','UPDATE') = true`), despite the deliberate `increment_listing_view()` SECURITY DEFINER RPC existing precisely to control that counter.
- Impact: fake social proof; skews `ci_listing_stats`/insights and any future ranking that uses views.

### M2. Trust scores and internal pricing intelligence are world-readable — Confirmed issue (also flagged by the scanner)
- `ci_trust_scores / anyone reads ci_trust_scores` USING `true` exposes the full `breakdown` JSON per seller: `email_verified`, `phone_verified`, `completed_sales`, `repeat_customers`, `refund_pct`, `years_on_platform`. Competitors can enumerate every seller's real sales volume and refund rate.
- `ci_category_stats / anyone reads ci_category_stats` USING `true` exposes `recommended_price_cents`, `median_price_cents`, `active_inventory`, `trending_score` — internal marketplace BI, scrapeable by anyone.

### M3. No application-level rate limiting outside three DB triggers — Concern
- Present and good: `enforce_message_rate_limit` (60/hr), `enforce_report_rate_limit` (10/hr), `enforce_search_event_rate_limit`, `ci_log_event` (240/5min).
- Absent: listing creation, favourites, business review creation, conversation creation, image upload/storage writes, buyer-intent capture writes, and every server function except the 60s email-resend cooldown (`src/lib/notify.functions.ts:368`). A single script can create thousands of listings or conversations.

### M4. Anyone can flood `search_events` anonymously — Concern (previously reviewed and accepted)
- `search_events / Anyone can log a search event` accepts `anon` inserts; the trigger caps anonymous inserts at 200/min globally, which also means one attacker can suppress legitimate anonymous search logging for everyone (analytics denial). Data itself is not sensitive.

### M5. Service listings publish with no ban check and no moderation — Concern
- `service_listings_owner_insert` / `_owner_update` allow the provider to set `status = 'active'` directly, with no `is_user_banned()` guard (unlike `listings`, which has one). A banned user can still publish services; the public read policy shows any `active` row.

### M6. Business slug is freely mutable by the owner — Concern
- `businesses / Owner can update own business` covers all columns except the status/ownership fields guarded by `businesses_guard_status()`. An approved business can rename its `slug` to squat a competitor's expected URL, or change its name/description entirely after approval — approval does not pin the reviewed content.

### M7. Ten SECURITY DEFINER functions executable by `anon` — Concern (previously ignored, worth re-review before launch)
- The Supabase linter still reports 10 anon-executable and 11 authenticated-executable SECURITY DEFINER functions. Previous passes revoked the trigger helpers; the remainder are the deliberate public RPCs (`increment_listing_view`, `log_share_visit`, `service_public_availability`, `service_busy_slots`, `service_blocked_dates`, `ci_log_event`). Each is individually reasonable but they are unauthenticated write paths: `increment_listing_view` can be called in a loop to inflate any listing's views, and `log_share_visit` has no rate limit at all.

---

## Low

- **L1 — Audit logs are forgeable by admins.** `seller_growth_audit_log` and `seller_pipeline_history` accept direct `INSERT` from any admin session (`CHECK = has_role(admin)`), so the audit trail can be fabricated from the browser. `payment_audit_log` does this correctly (append-only via `payment_audit_log_immutable`) — worth matching.
- **L2 — `plan_settings` and `platform_feature_flags` are world-readable** (`USING true`). Reveals unlaunched features (`marketplace_payments_enabled`, `buyer_recommendations_enabled`) and plan limits. Informational only.
- **L3 — `buyer_intents` are user-updatable.** `Users update own buyer intents` lets a user rewrite their own `score`/`signal_count`, which will matter once `buyer_recommendations_enabled` is turned on and those scores drive ranking or seller-facing demand signals.
- **L4 — `booking_status_history` accepts direct inserts from either party** (`bsh_parties_insert`), so the timeline shown to the other party can be padded with events that never happened.
- **L5 — `extension in public`** (Supabase linter). Hygiene.
- **L6 — Admin UI relies on client-side `useIsModerator()`** (`src/lib/useIsModerator.ts`) as the render gate, and the moderation mutations in `src/routes/_authenticated/admin.index.tsx:101,113,127` are direct browser writes. This one is *safe*: the underlying RLS (`reports / mods update reports`, `listings / sellers update own listings`, `profiles`) independently re-checks `private.has_role`. Recording it so it isn't mistaken for a gap later.

---

## Working as designed (verified, no action)

- **Server functions**: `admins.functions.ts`, `paymentsAdmin.functions.ts`, `whatsapp-admin.functions.ts`, `sellerGrowth.functions.ts`, `campaigns.functions.ts`, `plans.functions.ts`, `draftStore.functions.ts`, `profiles.functions.ts` all call `assertAdmin`/`assertStaff` against `user_roles` using the middleware-derived `userId` before touching `supabaseAdmin`. No role check trusts client input.
- **Webhooks**: `src/routes/api/public/payments/webhook.ts` and `src/routes/api/public/whatsapp/webhook.ts` verify HMAC signatures with `timingSafeEqual` before any DB access, with idempotency via unique event keys.
- **Secrets**: no module-scope `process.env` reads; `whatsapp-admin.functions.ts:27,67-69` returns only booleans for secret presence. Service-role key never reaches the client.
- **Payments gating**: `payments_enabled()` feature flag is woven into the RLS `USING` clauses of `payment_transactions`, `payment_refunds`, `payment_disputes`, `seller_payouts`, `seller_payment_accounts` and `commission_rules` — so payment data stays invisible even if UI gating were bypassed. `payment_audit_log` is append-only. Genuinely well done.
- **Roles**: stored in a separate `user_roles` table, checked through `private.has_role` SECURITY DEFINER. No role column on `profiles`. Correct pattern.
- **MCP tools**: read-only tools scope to `status = 'active'`; `list-my-*` tools require `ctx.isAuthenticated()` and filter by `ctx.getUserId()`.
- **Listing/image visibility**: `listings` and `listing_images` public-read policies both check status, `deleted_at` and `is_user_banned(seller_id)` — consistent, no bypass via the images table.
- **Profiles read**: `banned_at` is not selectable by `anon`; banned profiles are hidden from public read.
- **Service answers**: `sla_public_read` correctly excludes fields flagged `sensitive` in `service_template_fields`.

---

## Launch blockers, in order

1. **C1** — self-un-ban. Moderation does not currently hold.
2. **H3** — unauthenticated AI endpoint. Open-ended cost exposure from day one.
3. **H1 / H2** — message tampering and conversation reassignment. Both are trust-destroying if discovered post-launch.
4. **H4** — booking time mutation. Ship before real bookings accumulate.
5. **M1 / M2** — metric inflation and BI exposure.

Everything above is diagnosis only; say the word and I'll implement the fixes for whichever items you want, starting with the blockers.
