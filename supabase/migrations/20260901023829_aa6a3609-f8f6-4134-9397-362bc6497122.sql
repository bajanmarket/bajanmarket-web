CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ai usage"
ON public.ai_usage_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX ai_usage_events_user_feature_created_idx
ON public.ai_usage_events (user_id, feature, created_at DESC);