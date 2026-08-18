-- 1. Lead extensions
ALTER TABLE public.seller_prospects
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS social_platform text,
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_status text,
  ADD COLUMN IF NOT EXISTS acquisition_status text NOT NULL DEFAULT 'discovered';

ALTER TABLE public.seller_prospects
  DROP CONSTRAINT IF EXISTS seller_prospects_acquisition_status_check;
ALTER TABLE public.seller_prospects
  ADD CONSTRAINT seller_prospects_acquisition_status_check CHECK (acquisition_status IN (
    'discovered','qualified','draft_store_created','preview_ready','outreach_ready',
    'contacted','preview_viewed','claim_started','claimed','rejected','duplicate','archived'));

-- 2. Discovered social posts
CREATE TABLE IF NOT EXISTS public.lead_social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  source_platform text,
  source_url text,
  posted_at timestamptz,
  caption text,
  image_url text,
  content_type text NOT NULL DEFAULT 'unknown',
  detected_title text,
  detected_price numeric,
  detected_currency text DEFAULT 'BBD',
  detected_category text,
  description text,
  cta text,
  availability text,
  import_status text NOT NULL DEFAULT 'discovered',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_social_posts TO authenticated;
GRANT ALL ON public.lead_social_posts TO service_role;
ALTER TABLE public.lead_social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage lead social posts" ON public.lead_social_posts
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- 3. Draft (unclaimed) storefronts
CREATE TABLE IF NOT EXISTS public.draft_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL UNIQUE REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  slug text NOT NULL,
  category text,
  tagline text,
  description text,
  logo_url text,
  cover_url text,
  contact_email text,
  contact_phone text,
  whatsapp text,
  website text,
  address text,
  parish text,
  hours jsonb,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_status text NOT NULL DEFAULT 'draft',
  claim_status text NOT NULL DEFAULT 'unclaimed',
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_method text,
  verification_note text,
  claimed_by_user_id uuid,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  published_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_stores TO authenticated;
GRANT ALL ON public.draft_stores TO service_role;
ALTER TABLE public.draft_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage draft stores" ON public.draft_stores
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "claimer can read own draft store" ON public.draft_stores
  FOR SELECT TO authenticated USING (auth.uid() = claimed_by_user_id);
CREATE TRIGGER trg_draft_stores_updated BEFORE UPDATE ON public.draft_stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Draft listings
CREATE TABLE IF NOT EXISTS public.draft_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_store_id uuid NOT NULL REFERENCES public.draft_stores(id) ON DELETE CASCADE,
  social_post_id uuid REFERENCES public.lead_social_posts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  price numeric,
  currency text NOT NULL DEFAULT 'BBD',
  category text,
  image_url text,
  source_url text,
  source_platform text,
  source_posted_at timestamptz,
  content_type text NOT NULL DEFAULT 'product',
  status text NOT NULL DEFAULT 'selected_for_preview',
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_listings TO authenticated;
GRANT ALL ON public.draft_listings TO service_role;
ALTER TABLE public.draft_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage draft listings" ON public.draft_listings
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "claimer can read own draft listings" ON public.draft_listings
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.draft_stores d WHERE d.id = draft_listings.draft_store_id AND d.claimed_by_user_id = auth.uid()));
CREATE TRIGGER trg_draft_listings_updated BEFORE UPDATE ON public.draft_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Claim tokens (hashed; raw token never stored)
CREATE TABLE IF NOT EXISTS public.store_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_store_id uuid NOT NULL REFERENCES public.draft_stores(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_hint text,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  claimed_by_user_id uuid,
  claimed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_claim_tokens TO authenticated;
GRANT ALL ON public.store_claim_tokens TO service_role;
ALTER TABLE public.store_claim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage claim tokens" ON public.store_claim_tokens
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- 6. Claim audit trail
CREATE TABLE IF NOT EXISTS public.store_claim_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_store_id uuid REFERENCES public.draft_stores(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.seller_prospects(id) ON DELETE SET NULL,
  event text NOT NULL,
  actor_user_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_claim_audit TO authenticated;
GRANT ALL ON public.store_claim_audit TO service_role;
ALTER TABLE public.store_claim_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read claim audit" ON public.store_claim_audit
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_lead_social_posts_prospect ON public.lead_social_posts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_draft_listings_store ON public.draft_listings(draft_store_id);
CREATE INDEX IF NOT EXISTS idx_claim_tokens_store ON public.store_claim_tokens(draft_store_id);
CREATE INDEX IF NOT EXISTS idx_claim_audit_store ON public.store_claim_audit(draft_store_id);