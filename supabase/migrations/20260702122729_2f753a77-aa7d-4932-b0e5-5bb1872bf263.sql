
-- 1) Move SECURITY DEFINER helpers out of the exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- Recreate policies that referenced public.has_role
DROP POLICY IF EXISTS "admins manage categories" ON public.categories;
CREATE POLICY "admins manage categories" ON public.categories FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "active listings public read" ON public.listings;
CREATE POLICY "active listings public read" ON public.listings FOR SELECT
  USING (
    status = ANY (ARRAY['active'::public.listing_status,'sold'::public.listing_status])
    OR auth.uid() = seller_id
    OR private.has_role(auth.uid(),'moderator'::public.app_role)
    OR private.has_role(auth.uid(),'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "sellers update own listings" ON public.listings;
CREATE POLICY "sellers update own listings" ON public.listings FOR UPDATE
  USING (
    auth.uid() = seller_id
    OR private.has_role(auth.uid(),'moderator'::public.app_role)
    OR private.has_role(auth.uid(),'admin'::public.app_role)
  )
  WITH CHECK (
    auth.uid() = seller_id
    OR private.has_role(auth.uid(),'moderator'::public.app_role)
    OR private.has_role(auth.uid(),'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "sellers delete own listings" ON public.listings;
CREATE POLICY "sellers delete own listings" ON public.listings FOR DELETE
  USING (auth.uid() = seller_id OR private.has_role(auth.uid(),'admin'::public.app_role));

DROP POLICY IF EXISTS "users see own reports" ON public.reports;
CREATE POLICY "users see own reports" ON public.reports FOR SELECT
  USING (
    auth.uid() = reporter_id
    OR private.has_role(auth.uid(),'moderator'::public.app_role)
    OR private.has_role(auth.uid(),'admin'::public.app_role)
  );

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Move increment_listing_views into private (no longer RPC-callable)
CREATE OR REPLACE FUNCTION private.increment_listing_views(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.listings SET views = views + 1 WHERE id = _id AND status = 'active' $$;
REVOKE ALL ON FUNCTION private.increment_listing_views(uuid) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.increment_listing_views(uuid);

-- 2) Move phone off public-readable profiles into an owner-only private table
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.profile_private (user_id, phone)
  SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
  ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own private profile" ON public.profile_private;
CREATE POLICY "own private profile" ON public.profile_private FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profile_private_set_updated_at
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
