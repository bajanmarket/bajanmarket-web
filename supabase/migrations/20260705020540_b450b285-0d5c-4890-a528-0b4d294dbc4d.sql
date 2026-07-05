
-- businesses table
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  logo_url text,
  banner_url text,
  contact_email text,
  contact_phone text,
  whatsapp text,
  website text,
  address text,
  parish text,
  hours jsonb,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT businesses_status_check CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT businesses_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60),
  CONSTRAINT businesses_owner_unique UNIQUE (owner_id)
);

GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved businesses"
  ON public.businesses FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Owner can view own business"
  ON public.businesses FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins/mods can view all businesses"
  ON public.businesses FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'moderator'::app_role));

CREATE POLICY "Owner can create own business (pending)"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND status = 'pending');

CREATE POLICY "Owner can update own business"
  ON public.businesses FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id AND status IN ('pending','approved','rejected'));

CREATE POLICY "Admins can update any business"
  ON public.businesses FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owner or admin can delete"
  ON public.businesses FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR private.has_role(auth.uid(),'admin'::app_role));

-- Prevent non-admin from flipping their own status to 'approved'
CREATE OR REPLACE FUNCTION public.businesses_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.has_role(auth.uid(),'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can change business status';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER businesses_guard_status_trg
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_guard_status();

CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX businesses_status_idx ON public.businesses(status);
CREATE INDEX businesses_owner_idx ON public.businesses(owner_id);

-- reviews table
CREATE TABLE public.business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT business_reviews_unique UNIQUE (business_id, reviewer_id)
);

GRANT SELECT ON public.business_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_reviews TO authenticated;
GRANT ALL ON public.business_reviews TO service_role;

ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view reviews of approved businesses"
  ON public.business_reviews FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.status = 'approved'));

CREATE POLICY "Signed-in users can create own review"
  ON public.business_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.status = 'approved' AND b.owner_id <> auth.uid())
  );

CREATE POLICY "Reviewer can update own review"
  ON public.business_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewer or admin can delete"
  ON public.business_reviews FOR DELETE TO authenticated
  USING (auth.uid() = reviewer_id OR private.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER business_reviews_set_updated_at
  BEFORE UPDATE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX business_reviews_business_idx ON public.business_reviews(business_id);
