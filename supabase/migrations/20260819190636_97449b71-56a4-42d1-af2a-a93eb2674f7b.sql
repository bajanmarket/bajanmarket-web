CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'website',
  source_platform text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_scanned_at timestamptz,
  scan_status text NOT NULL DEFAULT 'not_scanned',
  firecrawl_status text,
  extraction_status text,
  error_message text,
  items_found integer NOT NULL DEFAULT 0,
  images_found integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lead_sources_lead_url_key ON public.lead_sources(lead_id, source_url);
CREATE INDEX lead_sources_lead_idx ON public.lead_sources(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead sources" ON public.lead_sources
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.discovered_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  source_url text,
  source_platform text,
  content_type text NOT NULL DEFAULT 'product',
  title text,
  original_text text,
  cleaned_text text,
  detected_price numeric(12,2),
  currency text NOT NULL DEFAULT 'BBD',
  original_image_url text,
  stored_image_url text,
  image_hash text,
  source_date timestamptz,
  extraction_confidence text NOT NULL DEFAULT 'low',
  extraction_status text NOT NULL DEFAULT 'extracted',
  merchant_approval_status text NOT NULL DEFAULT 'pending',
  included boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX discovered_content_lead_idx ON public.discovered_content(lead_id);
CREATE UNIQUE INDEX discovered_content_image_key ON public.discovered_content(lead_id, image_hash) WHERE image_hash IS NOT NULL;
CREATE UNIQUE INDEX discovered_content_title_key ON public.discovered_content(lead_id, source_url, title) WHERE title IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovered_content TO authenticated;
GRANT ALL ON public.discovered_content TO service_role;
ALTER TABLE public.discovered_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage discovered content" ON public.discovered_content
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION private.touch_discovered_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.touch_discovered_content() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER discovered_content_updated_at
  BEFORE UPDATE ON public.discovered_content
  FOR EACH ROW EXECUTE FUNCTION private.touch_discovered_content();