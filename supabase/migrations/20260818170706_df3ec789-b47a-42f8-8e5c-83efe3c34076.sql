REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, display_name, avatar_url, bio, parish, created_at, last_active_at, listings_count)
  ON public.profiles TO anon;

GRANT SELECT (id, display_name, avatar_url, bio, parish, created_at, updated_at, last_active_at, listings_count, onboarded_at)
  ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;