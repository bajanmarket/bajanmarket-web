
CREATE TABLE public.search_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  query text NOT NULL,
  parish public.parish NULL,
  category_slug text NULL,
  result_count integer NOT NULL DEFAULT 0,
  user_id uuid NULL
);

GRANT INSERT ON public.search_events TO anon, authenticated;
GRANT SELECT ON public.search_events TO authenticated;
GRANT ALL ON public.search_events TO service_role;

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a search event"
  ON public.search_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(query) > 0
    AND length(query) <= 200
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Moderators and admins can read search events"
  ON public.search_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('moderator'::public.app_role, 'admin'::public.app_role)
    )
  );

CREATE INDEX search_events_created_at_idx ON public.search_events (created_at DESC);
CREATE INDEX search_events_query_lower_idx ON public.search_events (lower(query));
