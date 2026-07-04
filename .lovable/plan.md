## Marketing & outreach data collection

Add four capabilities so you can legally and effectively promote to your users. Everything is opt-in and admin-only for reading in aggregate.

### 1. Marketing consent + channel preferences

New table `public.marketing_preferences` (one row per user):
- `user_id` (PK, references auth.users)
- `email_opt_in` bool, default false
- `sms_opt_in` bool, default false
- `whatsapp_opt_in` bool, default false
- `whatsapp_number` text (nullable, distinct from `profile_private.phone`)
- `marketing_email` text (nullable — lets users route promos to a different address than their login email)
- `unsubscribe_token` uuid, default `gen_random_uuid()` (for one-click unsubscribe links)
- `consented_at`, `updated_at`

RLS: user reads/writes own row; admin/moderator can SELECT all.

UI:
- New "Communication preferences" card on `/profile` (below the settings form) with three toggles + WhatsApp number + alt email fields.
- Signup form on `/auth` gets an unchecked "Send me tips and promos from Bajan.market" checkbox that seeds `email_opt_in`.

### 2. Engagement snapshot on profile

Extend `public.profiles` with cached counters + activity timestamps so admins can segment without heavy joins:
- `last_active_at` timestamptz (bumped on any listing/message/favourite write via triggers, plus on session refresh)
- `listings_count` int default 0
- `favourites_count` int default 0
- `messages_sent_count` int default 0
- `first_listing_at`, `first_message_at` timestamptz (nullable)

Maintained by three simple AFTER INSERT triggers on `listings`, `favourites`, `messages` that increment counters and set the "first_*" timestamps on first write. `last_active_at` also bumped by a lightweight client ping (already have session state).

### 3. Interest tags (auto-derived, no user input)

New view (or materialised view refreshed nightly) `public.user_interest_tags`:
- Aggregates each user's top 3 categories across favourites, search_events, and their own listings.
- Columns: `user_id`, `top_categories text[]`, `top_parishes text[]`, `computed_at`.

Admin-only SELECT. Feeds segmentation like "users interested in Electronics in St. Michael".

### 4. Onboarding survey

Single lightweight step shown once after first signup (before landing on `/`):
- "What brings you to Bajan.market?" — Buying / Selling / Both (radio)
- "Which categories interest you?" — multiselect chips from existing `categories` table (max 3)

Stored on `profiles`:
- `onboarding_intent text` (`buyer` | `seller` | `both` | null)
- `onboarding_categories text[]` (category slugs)
- `onboarded_at timestamptz`

Skippable. Presence of `onboarded_at` gates the modal.

### 5. Admin: Audience tab

Extend `/admin` with a new **Audience** tab (moderator/admin only) showing:
- Total users, opt-in counts per channel
- Segment builder: filter by parish, intent, top category, activity (last 7/30d), opt-in channel
- Export selected segment as CSV (email + display_name + parish + top_categories) — for pasting into your ESP

Uses a new `getAudienceSegment` server fn (`requireSupabaseAuth` + `has_role('moderator')` check) that joins profiles + marketing_preferences + user_interest_tags with the chosen filters.

### Technical section

**Migrations (single SQL, in order):**

```text
1. CREATE TABLE public.marketing_preferences (...)
   GRANT SELECT, INSERT, UPDATE ON public.marketing_preferences TO authenticated;
   GRANT ALL ON public.marketing_preferences TO service_role;
   ALTER TABLE ... ENABLE RLS;
   Policies:
     - own_read: user_id = auth.uid()
     - own_write: user_id = auth.uid()
     - admin_read: has_role(auth.uid(), 'moderator')

2. ALTER TABLE public.profiles ADD COLUMN last_active_at, listings_count,
   favourites_count, messages_sent_count, first_listing_at, first_message_at,
   onboarding_intent, onboarding_categories, onboarded_at.

3. CREATE OR REPLACE FUNCTION bump_profile_counters_* (three functions,
   SECURITY DEFINER, search_path=public) + AFTER INSERT triggers on
   listings/favourites/messages.

4. CREATE VIEW public.user_interest_tags AS <aggregate query>;
   GRANT SELECT ON public.user_interest_tags TO authenticated;
   (View inherits RLS from underlying tables; wrap access behind the
   admin-only server fn.)
```

**Files:**
- New: `src/components/MarketingPrefs.tsx`, `src/components/OnboardingModal.tsx`, `src/components/AudiencePanel.tsx`, `src/lib/audience.functions.ts`, `src/lib/lastActive.ts` (client heartbeat).
- Edit: `src/routes/_authenticated/profile.tsx` (add prefs card), `src/routes/auth.tsx` (opt-in checkbox on signup + write to `marketing_preferences` after account creation), `src/routes/_authenticated/route.tsx` or `__root.tsx` (mount onboarding modal when `onboarded_at is null`), `src/routes/_authenticated/admin.tsx` (add Audience tab).

**Consent + privacy:**
- Defaults are all `false`. No pre-checked marketing boxes.
- Signup checkbox stores explicit `consented_at`.
- Unsubscribe tokens allow one-click opt-out links in future emails.
- Update `/privacy` page copy to disclose the new fields, purposes, and retention. (Copy edit only, listed under files above once approved.)

### Out of scope for this plan
- Actual email/SMS sending (needs an ESP + custom sender domain — separate step).
- Campaign builder / scheduling.
- Listing view tracking per user (item 5 from the earlier suggestions).
- Referral / UTM capture (item 6).
- Neighbourhood-level location (item 7).
