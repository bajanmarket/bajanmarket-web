-- Phase 2: Buyer Intent + Listing Matching data foundation (additive only)

-- 1. Buyer intents ------------------------------------------------------------
CREATE TABLE public.buyer_intents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id         uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  intent_key          text NOT NULL,
  normalized_query    text NOT NULL,
  raw_queries         text[] NOT NULL DEFAULT '{}',
  keywords            text[] NOT NULL DEFAULT '{}',
  min_price           numeric,
  max_price           numeric,
  preferred_condition public.listing_condition,
  preferred_parish    public.parish,
  attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
  intent_score        integer NOT NULL DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  signal_count        integer NOT NULL DEFAULT 1 CHECK (signal_count >= 0),
  active              boolean NOT NULL DEFAULT true,
  first_seen          timestamptz NOT NULL DEFAULT now(),
  last_seen           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_intents_user_key_uniq UNIQUE (user_id, intent_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_intents TO authenticated;
GRANT ALL ON public.buyer_intents TO service_role;

ALTER TABLE public.buyer_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own buyer intents"
  ON public.buyer_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own buyer intents"
  ON public.buyer_intents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own buyer intents"
  ON public.buyer_intents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own buyer intents"
  ON public.buyer_intents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read buyer intents"
  ON public.buyer_intents FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX buyer_intents_user_last_seen_idx
  ON public.buyer_intents (user_id, last_seen DESC);
CREATE INDEX buyer_intents_category_active_idx
  ON public.buyer_intents (category_id)
  WHERE active;

CREATE TRIGGER trg_buyer_intents_updated
  BEFORE UPDATE ON public.buyer_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Buyer activity events (listing_viewed only) ------------------------------
CREATE TABLE public.buyer_activity_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  event_type  text NOT NULL DEFAULT 'listing_viewed'
              CHECK (event_type IN ('listing_viewed')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.buyer_activity_events TO authenticated;
GRANT ALL ON public.buyer_activity_events TO service_role;

ALTER TABLE public.buyer_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own activity events"
  ON public.buyer_activity_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users log own activity events"
  ON public.buyer_activity_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own activity events"
  ON public.buyer_activity_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read activity events"
  ON public.buyer_activity_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX buyer_activity_user_time_idx
  ON public.buyer_activity_events (user_id, occurred_at DESC);
CREATE INDEX buyer_activity_listing_idx
  ON public.buyer_activity_events (listing_id);
CREATE INDEX buyer_activity_category_time_idx
  ON public.buyer_activity_events (category_id, occurred_at DESC);

-- 3. Feature flags (both OFF) --------------------------------------------------
INSERT INTO public.platform_feature_flags (key, enabled, description)
VALUES
  ('buyer_intent_capture_enabled', false, 'Silently capture and process buyer intent signals'),
  ('buyer_recommendations_enabled', false, 'Show personalised buyer recommendations in the UI')
ON CONFLICT (key) DO NOTHING;