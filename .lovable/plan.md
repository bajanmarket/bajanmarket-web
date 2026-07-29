# Stage 1 — Inspection & Implementation Plan

No code or database changes have been made yet.

## What exists today

**Frontend (TanStack Start + React)**
- Routes: public (`index`, `browse`, `listing.$id`, `seller.$id`, `business.$slug`, legal, `auth`, `reset-password`, `unsubscribe`) and protected under `_authenticated/` (`post`, `my-listings`, `favourites`, `messages`, `messages.$id`, `profile`, `business`, `campaigns`, `admin`).
- Shared UI: `AppShell`, `TopHeader`, `BottomNav`, `Footer`, `ListingCard`, `CategoryChips`, `SearchBar`, `ShareMenu`, `ReportDialog`, shadcn `ui/`.
- Admin dashboard is a single page with a section switcher: Reports, Analytics, Insights, Audience, Admins, Businesses, Marketplace (+ Campaigns link). New admin sections plug in as one more panel component — no restructuring needed.
- Auth via `useAuth`, roles via `useIsModerator` (`user_roles` + `has_role`).
- Notifications today = in-app/browser toasts for messages (`useMessageNotifications`), email via Resend campaigns, marketing consent in `marketing_preferences` + `MarketingPrefs` card.

**Database (relevant pieces)**
- `listings` (product marketplace), `categories`, `listing_images`, `favourites`.
- `conversations` (listing_id, buyer_id, seller_id, hidden flags) + `messages` with rate-limit triggers. `conversations.listing_id` is currently NOT NULL — this is the one existing column that must change (to nullable) for booking-only conversations.
- `businesses`, `business_reviews`, `subscriptions`, `plan_settings`, `profiles`, `profile_private` (phone), `reports`, `ci_*` analytics, email queue tables.
- Storage buckets `listings`, `avatars` (private, signed URLs).

## Guiding constraints for every stage
- Additive migrations only: new tables, new nullable columns, new policies. No drops, no renames, no data deletes. Existing product listings, messaging, tiers, roles and admin functions stay untouched.
- Service data lives in **new** tables (`service_*`, `bookings*`), not by overloading `listings`, so the product marketplace is unaffected.
- Every new table gets GRANTs, RLS, indexes and timestamps. Sensitive booking answers get a strict "parties + admin only" policy and are never exposed to `anon`.
- Reuse existing design tokens, `AppShell`, form styles, toast patterns, and the existing messaging system.

## Stage 2 — Database structure
New tables:
- `service_categories` (slug, name, icon, active, instant_booking_allowed, requires_approval, cancellation_policy, sort_order)
- `service_template_fields` (category_id, audience `provider|buyer`, key, label, field_type, options, required, sensitive, sort_order)
- `service_listings` (provider_id, category_id, title, description, price, price_unit, parish, areas_served, mobile_service, duration_minutes, status, cover image)
- `service_listing_answers` (provider template answers)
- `provider_availability` (weekday, start/end, break windows, slot minutes, buffer, max daily bookings, min notice, advance limit, timezone default `America/Barbados`)
- `provider_blocked_dates`
- `bookings` (reference, service_listing_id, provider_id, buyer_id, starts_at, ends_at, status enum, conversation_id, location, price)
- `booking_answers` (buyer template answers; sensitive rows gated)
- `booking_status_history`
- `notification_preferences` (in-app / email / whatsapp per event group)
- `notifications` (in-app notification centre rows)
- `notification_deliveries` (channel, status, error)
- `whatsapp_consent` (phone, verified_at, consented_at, method, opted_out_at)
Plus: `conversations.listing_id` made nullable and a nullable `booking_id` added; a unique partial index preventing overlapping confirmed bookings per provider (double-booking prevention enforced in DB, not just UI).

## Stage 3 — Services marketplace + booking flow
- `/services` browse (category, parish, price, rating, availability filters), `/services/$id` service page with live slot picker, provider profile links.
- Provider-side create/edit service under `_authenticated/`, driven entirely by the admin template (providers answer fields, they don't invent them).
- Availability editor (working days, hours, breaks, duration, buffer, blocked dates, limits).
- Booking wizard: date → time → standardized buyer form → review → submit → reference number.
- Admin panel section **Service Templates** (CRUD categories and fields, reorder, activate/deactivate, booking rules) seeded with the 10 categories and exact field lists from your brief.

## Stage 4 — Dashboards
- Buyer: Upcoming / Pending / Completed / Cancelled / Reschedule requests.
- Provider: Today / Upcoming / Pending approval / Reschedule / Completed / Cancelled / Calendar view.
- Both mobile-first with large touch targets; entry points added alongside existing profile links (nothing removed).

## Stage 5 — Calendar
- Server-generated `.ics` download plus Google / Apple / Outlook links, containing only safe fields (service, reference, times, provider/buyer names, location, link back). No medical, childcare, access or allergy details.

## Stage 6 — Messaging + notification centre
- One conversation per booking, reused on every update (no duplicates); booking reference shown in-thread.
- Notification centre for all listed booking and message events, routed only to the relevant buyer/provider/admin, with email via the existing Resend setup.

## Stage 7 — WhatsApp (needs your input)
- Official WhatsApp Business Platform (Meta Cloud API) or Twilio — no unofficial automation.
- Opt-in with consent text, phone verification, opt-out, consent audit trail; notification content limited to activity alerts plus a secure link.
- **Requires credentials from you** (WhatsApp Business account, phone number ID, permanent access token, approved templates). I'll build the preference/consent UI and backend integration behind a feature flag so it ships inert until credentials exist.

## Stage 8 — Testing
Regression pass over product listings, sign-up/sign-in, profiles, messaging, tiers, admin panels; then service creation, each template, availability, double-booking, instant vs manual approval, reschedule/cancel, calendar links, notifications, WhatsApp opt-in/out and failure paths, mobile breakpoints, and RLS/unauthorized-access checks.

## Technical notes
- Backups: Lovable Cloud keeps automatic database backups; migrations here are additive-only, so the restore point is the pre-migration state and no destructive statement will be issued.
- The single change to an existing table is `conversations.listing_id` → nullable (plus a new nullable `booking_id`). All existing rows and queries continue to work.
- Legal text: I'll summarize the new data flows and propose Privacy/Terms wording for your review rather than publishing legal changes silently.

## Two questions before Stage 2
1. WhatsApp provider preference — Meta Cloud API direct, or Twilio? (Affects the Stage 7 backend.)
2. Should service providers be limited to paid tiers (Premium/Business), or can any signed-in user publish a service?
