CREATE TABLE public.share_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.share_visits TO authenticated;
GRANT ALL ON public.share_visits TO service_role;

ALTER TABLE public.share_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and moderators can read share visits"
  ON public.share_visits FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX share_visits_created_at_idx ON public.share_visits (created_at DESC);
CREATE INDEX share_visits_source_idx ON public.share_visits (utm_source, utm_campaign);

CREATE OR REPLACE FUNCTION public.log_share_visit(
  _path text,
  _utm_source text,
  _utm_medium text,
  _utm_campaign text,
  _referrer text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _path IS NULL OR length(_path) > 512 THEN RETURN; END IF;
  INSERT INTO public.share_visits (path, utm_source, utm_medium, utm_campaign, referrer)
  VALUES (
    left(_path, 512),
    NULLIF(left(_utm_source, 64), ''),
    NULLIF(left(_utm_medium, 64), ''),
    NULLIF(left(_utm_campaign, 128), ''),
    NULLIF(left(_referrer, 512), '')
  );
END $$;

GRANT EXECUTE ON FUNCTION public.log_share_visit(text, text, text, text, text) TO anon, authenticated;