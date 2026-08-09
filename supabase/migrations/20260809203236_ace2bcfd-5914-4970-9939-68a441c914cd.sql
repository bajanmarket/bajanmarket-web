-- Trigger helper functions: only ever fired by the database, never called directly.
REVOKE ALL ON FUNCTION public.bookings_guard_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_favourites_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_listings_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_messages_counter() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.businesses_guard_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_booking_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

-- Email queue internals: invoked by cron and the service-role queue processor only.
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Maintenance / analytics jobs: service-role only.
REVOKE ALL ON FUNCTION public.ci_refresh_rollups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ci_refresh_category_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ci_refresh_trust_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ci_compute_trust_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_refresh_rollups() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_refresh_category_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_refresh_trust_scores() TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_compute_trust_score(uuid) TO service_role;

-- Admin-only marketing lookup: enforced in-function, but not reachable anonymously.
REVOKE ALL ON FUNCTION public.get_user_interest_tags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_interest_tags(uuid) TO authenticated, service_role;

-- Genuinely client-callable: keep access, but drop the implicit PUBLIC grant.
REVOKE ALL ON FUNCTION public.increment_listing_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_share_visit(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_share_visit(text, text, text, text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.service_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.ci_log_event(text, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ci_log_event(text, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) TO anon, authenticated, service_role;