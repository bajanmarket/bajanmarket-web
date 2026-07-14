
-- =========================================================
-- Commerce Intelligence module — additive migration
-- All tables are new. No existing tables are modified.
-- =========================================================

-- ---------- 1. ci_events (append-only event log) ----------
CREATE TABLE public.ci_events (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type    TEXT NOT NULL,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id    UUID,
  business_id   UUID,
  category_id   UUID,
  campaign_id   UUID,
  campaign_code TEXT,
  session_id    TEXT,
  source        TEXT,
  medium        TEXT,
  referrer      TEXT,
  path          TEXT,
  parish        TEXT,
  device        TEXT,
  browser       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ci_events TO authenticated;
GRANT ALL    ON public.ci_events TO service_role;

ALTER TABLE public.ci_events ENABLE ROW LEVEL SECURITY;

-- Sellers can see events attributed to them
CREATE POLICY "seller reads own ci_events"
  ON public.ci_events FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR auth.uid() = actor_id);

-- Admins can read everything (uses existing private.has_role helper)
CREATE POLICY "admin reads all ci_events"
  ON public.ci_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX ci_events_seller_time_idx   ON public.ci_events (seller_id, occurred_at DESC);
CREATE INDEX ci_events_listing_time_idx  ON public.ci_events (listing_id, occurred_at DESC);
CREATE INDEX ci_events_campaign_time_idx ON public.ci_events (campaign_id, occurred_at DESC);
CREATE INDEX ci_events_type_time_idx     ON public.ci_events (event_type, occurred_at DESC);
CREATE INDEX ci_events_session_idx       ON public.ci_events (session_id);


-- ---------- 2. attribution_campaigns ----------
-- Seller-generated tracking links. Named `attribution_campaigns` to avoid
-- collision with the existing email `campaigns` table.
CREATE TABLE public.attribution_campaigns (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  channel          TEXT NOT NULL,          -- 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'email' | 'qr' | 'influencer' | 'flyer' | 'radio' | 'event' | 'other'
  destination_path TEXT NOT NULL DEFAULT '/',
  cost_cents       INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  notes            TEXT,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribution_campaigns TO authenticated;
GRANT ALL ON public.attribution_campaigns TO service_role;

ALTER TABLE public.attribution_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own attribution_campaigns"
  ON public.attribution_campaigns FOR ALL TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "admin reads all attribution_campaigns"
  ON public.attribution_campaigns FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX attribution_campaigns_seller_idx ON public.attribution_campaigns (seller_id, created_at DESC);

CREATE TRIGGER attribution_campaigns_set_updated_at
  BEFORE UPDATE ON public.attribution_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- 3. ci_orders (opt-in seller-logged sales) ----------
CREATE TABLE public.ci_orders (
  id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id               UUID,
  buyer_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id          UUID,
  amount_cents             INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency                 TEXT NOT NULL DEFAULT 'BBD',
  status                   TEXT NOT NULL DEFAULT 'completed', -- completed | refunded | cancelled
  sold_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  attribution_campaign_id  UUID REFERENCES public.attribution_campaigns(id) ON DELETE SET NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_orders TO authenticated;
GRANT ALL ON public.ci_orders TO service_role;

ALTER TABLE public.ci_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own ci_orders"
  ON public.ci_orders FOR ALL TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "admin reads all ci_orders"
  ON public.ci_orders FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX ci_orders_seller_time_idx   ON public.ci_orders (seller_id, sold_at DESC);
CREATE INDEX ci_orders_listing_idx       ON public.ci_orders (listing_id);
CREATE INDEX ci_orders_campaign_idx      ON public.ci_orders (attribution_campaign_id);

CREATE TRIGGER ci_orders_set_updated_at
  BEFORE UPDATE ON public.ci_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- 4. ci_daily_stats (per-seller per-day rollup) ----------
CREATE TABLE public.ci_daily_stats (
  seller_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day              DATE NOT NULL,
  views            INTEGER NOT NULL DEFAULT 0,
  messages         INTEGER NOT NULL DEFAULT 0,
  shares           INTEGER NOT NULL DEFAULT 0,
  favourites       INTEGER NOT NULL DEFAULT 0,
  orders           INTEGER NOT NULL DEFAULT 0,
  revenue_cents    BIGINT  NOT NULL DEFAULT 0,
  unique_visitors  INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, day)
);

GRANT SELECT ON public.ci_daily_stats TO authenticated;
GRANT ALL    ON public.ci_daily_stats TO service_role;

ALTER TABLE public.ci_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller reads own ci_daily_stats"
  ON public.ci_daily_stats FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "admin reads all ci_daily_stats"
  ON public.ci_daily_stats FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));


-- ---------- 5. ci_listing_stats ----------
CREATE TABLE public.ci_listing_stats (
  listing_id           UUID NOT NULL PRIMARY KEY,
  seller_id            UUID NOT NULL,
  views                INTEGER NOT NULL DEFAULT 0,
  messages             INTEGER NOT NULL DEFAULT 0,
  shares               INTEGER NOT NULL DEFAULT 0,
  favourites           INTEGER NOT NULL DEFAULT 0,
  first_sold_at        TIMESTAMPTZ,
  time_to_sale_hours   NUMERIC,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ci_listing_stats TO authenticated;
GRANT ALL    ON public.ci_listing_stats TO service_role;

ALTER TABLE public.ci_listing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller reads own ci_listing_stats"
  ON public.ci_listing_stats FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "admin reads all ci_listing_stats"
  ON public.ci_listing_stats FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX ci_listing_stats_seller_idx ON public.ci_listing_stats (seller_id);


-- ---------- 6. ci_category_stats (market intelligence, public read) ----------
CREATE TABLE public.ci_category_stats (
  category_id             UUID NOT NULL PRIMARY KEY,
  avg_price_cents         BIGINT,
  median_price_cents      BIGINT,
  avg_time_to_sell_hours  NUMERIC,
  active_inventory        INTEGER NOT NULL DEFAULT 0,
  trending_score          NUMERIC NOT NULL DEFAULT 0,
  recommended_price_cents BIGINT,
  recommended_post_dow    INTEGER, -- 0-6
  recommended_post_hour   INTEGER, -- 0-23
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ci_category_stats TO anon, authenticated;
GRANT ALL    ON public.ci_category_stats TO service_role;

ALTER TABLE public.ci_category_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads ci_category_stats"
  ON public.ci_category_stats FOR SELECT TO anon, authenticated
  USING (true);


-- ---------- 7. ci_trust_scores (cached per-seller trust) ----------
CREATE TABLE public.ci_trust_scores (
  seller_id    UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  breakdown    JSONB   NOT NULL DEFAULT '{}'::jsonb,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trust score is a public signal shown on seller/business pages
GRANT SELECT ON public.ci_trust_scores TO anon, authenticated;
GRANT ALL    ON public.ci_trust_scores TO service_role;

ALTER TABLE public.ci_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads ci_trust_scores"
  ON public.ci_trust_scores FOR SELECT TO anon, authenticated
  USING (true);


-- =========================================================
-- Public tracking RPC (SECURITY DEFINER + light rate limit)
-- Lets anon/auth clients log events without exposing ci_events.
-- =========================================================
CREATE OR REPLACE FUNCTION public.ci_log_event(
  _event_type    TEXT,
  _seller_id     UUID DEFAULT NULL,
  _listing_id    UUID DEFAULT NULL,
  _business_id   UUID DEFAULT NULL,
  _category_id   UUID DEFAULT NULL,
  _campaign_code TEXT DEFAULT NULL,
  _session_id    TEXT DEFAULT NULL,
  _source        TEXT DEFAULT NULL,
  _medium        TEXT DEFAULT NULL,
  _referrer      TEXT DEFAULT NULL,
  _path          TEXT DEFAULT NULL,
  _parish        TEXT DEFAULT NULL,
  _device        TEXT DEFAULT NULL,
  _browser       TEXT DEFAULT NULL,
  _metadata      JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid  UUID;
  _cnt  INTEGER;
  _sid  TEXT := NULLIF(left(coalesce(_session_id, ''), 64), '');
BEGIN
  -- Cap event_type length; ignore obviously invalid input
  IF _event_type IS NULL OR length(_event_type) = 0 OR length(_event_type) > 64 THEN
    RETURN;
  END IF;

  -- Rate limit: max 240 events / 5 min per session (silent drop)
  IF _sid IS NOT NULL THEN
    SELECT count(*) INTO _cnt
      FROM public.ci_events
     WHERE session_id = _sid
       AND created_at > now() - interval '5 minutes';
    IF _cnt >= 240 THEN
      RETURN;
    END IF;
  END IF;

  -- Resolve campaign code (if any) to campaign id
  IF _campaign_code IS NOT NULL THEN
    SELECT id INTO _cid FROM public.attribution_campaigns
      WHERE code = _campaign_code AND archived_at IS NULL
      LIMIT 1;
  END IF;

  INSERT INTO public.ci_events (
    event_type, actor_id, seller_id, listing_id, business_id, category_id,
    campaign_id, campaign_code, session_id, source, medium, referrer, path,
    parish, device, browser, metadata
  ) VALUES (
    left(_event_type, 64),
    auth.uid(),
    _seller_id, _listing_id, _business_id, _category_id,
    _cid,
    NULLIF(left(coalesce(_campaign_code, ''), 64), ''),
    _sid,
    NULLIF(left(coalesce(_source, ''), 64), ''),
    NULLIF(left(coalesce(_medium, ''), 64), ''),
    NULLIF(left(coalesce(_referrer, ''), 512), ''),
    NULLIF(left(coalesce(_path, ''), 512), ''),
    NULLIF(left(coalesce(_parish, ''), 64), ''),
    NULLIF(left(coalesce(_device, ''), 32), ''),
    NULLIF(left(coalesce(_browser, ''), 32), ''),
    coalesce(_metadata, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.ci_log_event(
  TEXT, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO anon, authenticated;


-- =========================================================
-- Rollup helpers (called by cron via /api/public/ci/rollup)
-- =========================================================

-- Refresh ci_daily_stats + ci_listing_stats for last 48h of activity.
CREATE OR REPLACE FUNCTION public.ci_refresh_rollups()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Daily seller stats derived from ci_events + ci_orders
  INSERT INTO public.ci_daily_stats (seller_id, day, views, messages, shares, favourites, orders, revenue_cents, unique_visitors)
  SELECT
    seller_id,
    (occurred_at AT TIME ZONE 'UTC')::date AS day,
    count(*) FILTER (WHERE event_type = 'ListingViewed')       AS views,
    count(*) FILTER (WHERE event_type = 'MessageSent')          AS messages,
    count(*) FILTER (WHERE event_type = 'ListingShared')        AS shares,
    count(*) FILTER (WHERE event_type = 'ProductSaved')         AS favourites,
    0, 0,
    count(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS unique_visitors
  FROM public.ci_events
  WHERE seller_id IS NOT NULL
    AND occurred_at > now() - interval '48 hours'
  GROUP BY seller_id, day
  ON CONFLICT (seller_id, day) DO UPDATE SET
    views           = EXCLUDED.views,
    messages        = EXCLUDED.messages,
    shares          = EXCLUDED.shares,
    favourites      = EXCLUDED.favourites,
    unique_visitors = EXCLUDED.unique_visitors,
    updated_at      = now();

  -- Merge order totals into daily stats
  INSERT INTO public.ci_daily_stats (seller_id, day, orders, revenue_cents)
  SELECT
    seller_id,
    (sold_at AT TIME ZONE 'UTC')::date AS day,
    count(*) FILTER (WHERE status = 'completed'),
    coalesce(sum(amount_cents) FILTER (WHERE status = 'completed'), 0)
  FROM public.ci_orders
  WHERE sold_at > now() - interval '48 hours'
  GROUP BY seller_id, day
  ON CONFLICT (seller_id, day) DO UPDATE SET
    orders        = EXCLUDED.orders,
    revenue_cents = EXCLUDED.revenue_cents,
    updated_at    = now();

  -- Per-listing rollups
  INSERT INTO public.ci_listing_stats (listing_id, seller_id, views, messages, shares, favourites)
  SELECT
    l.id, l.seller_id,
    count(e.*) FILTER (WHERE e.event_type = 'ListingViewed'),
    count(e.*) FILTER (WHERE e.event_type = 'MessageSent'),
    count(e.*) FILTER (WHERE e.event_type = 'ListingShared'),
    count(e.*) FILTER (WHERE e.event_type = 'ProductSaved')
  FROM public.listings l
  LEFT JOIN public.ci_events e ON e.listing_id = l.id
  GROUP BY l.id, l.seller_id
  ON CONFLICT (listing_id) DO UPDATE SET
    seller_id  = EXCLUDED.seller_id,
    views      = EXCLUDED.views,
    messages   = EXCLUDED.messages,
    shares     = EXCLUDED.shares,
    favourites = EXCLUDED.favourites,
    updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.ci_refresh_rollups() TO service_role, authenticated;


-- Refresh market intelligence per category
CREATE OR REPLACE FUNCTION public.ci_refresh_category_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ci_category_stats (category_id, avg_price_cents, median_price_cents, active_inventory, trending_score, recommended_price_cents)
  SELECT
    l.category_id,
    (avg(l.price_cents))::bigint,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_cents))::bigint,
    count(*) FILTER (WHERE l.status = 'active'),
    coalesce((SELECT count(*) FROM public.ci_events e
              WHERE e.category_id = l.category_id
                AND e.event_type = 'ListingViewed'
                AND e.occurred_at > now() - interval '7 days'), 0)::numeric,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_cents))::bigint
  FROM public.listings l
  WHERE l.category_id IS NOT NULL
  GROUP BY l.category_id
  ON CONFLICT (category_id) DO UPDATE SET
    avg_price_cents         = EXCLUDED.avg_price_cents,
    median_price_cents      = EXCLUDED.median_price_cents,
    active_inventory        = EXCLUDED.active_inventory,
    trending_score          = EXCLUDED.trending_score,
    recommended_price_cents = EXCLUDED.recommended_price_cents,
    updated_at              = now();
END $$;

GRANT EXECUTE ON FUNCTION public.ci_refresh_category_stats() TO service_role, authenticated;


-- Recompute trust score for a single seller
CREATE OR REPLACE FUNCTION public.ci_compute_trust_score(_seller_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email_ok     BOOLEAN := false;
  _phone_ok     BOOLEAN := false;
  _biz_ok       BOOLEAN := false;
  _sales        INTEGER := 0;
  _repeat       INTEGER := 0;
  _reviews_avg  NUMERIC := 0;
  _reviews_cnt  INTEGER := 0;
  _years        NUMERIC := 0;
  _refund_pct   NUMERIC := 0;
  _score        INTEGER := 0;
  _breakdown    JSONB;
BEGIN
  SELECT (u.email_confirmed_at IS NOT NULL),
         (u.phone_confirmed_at IS NOT NULL),
         EXTRACT(EPOCH FROM (now() - u.created_at)) / 31557600.0
    INTO _email_ok, _phone_ok, _years
    FROM auth.users u WHERE u.id = _seller_id;

  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = _seller_id AND b.status = 'approved')
    INTO _biz_ok;

  SELECT count(*) FILTER (WHERE status = 'completed'),
         count(DISTINCT buyer_id) FILTER (WHERE status = 'completed' AND buyer_id IS NOT NULL)
    INTO _sales, _repeat
    FROM public.ci_orders WHERE seller_id = _seller_id;

  SELECT coalesce(avg(rating), 0), count(*)
    INTO _reviews_avg, _reviews_cnt
    FROM public.business_reviews br
    JOIN public.businesses b ON b.id = br.business_id
    WHERE b.owner_id = _seller_id;

  SELECT (100.0 * count(*) FILTER (WHERE status = 'refunded'))
         / NULLIF(count(*), 0)
    INTO _refund_pct
    FROM public.ci_orders WHERE seller_id = _seller_id;

  -- Weighted composite (max 100)
  _score := LEAST(100,
      (CASE WHEN _email_ok THEN 15 ELSE 0 END)
    + (CASE WHEN _phone_ok THEN 10 ELSE 0 END)
    + (CASE WHEN _biz_ok   THEN 15 ELSE 0 END)
    + LEAST(20, _sales)                                   -- 1pt / sale up to 20
    + LEAST(10, _repeat * 2)                              -- repeat buyers
    + (CASE WHEN _reviews_cnt > 0 THEN LEAST(15, (_reviews_avg * 3)::int) ELSE 0 END)
    + LEAST(10, floor(_years * 3)::int)                    -- tenure
    - LEAST(15, coalesce(_refund_pct, 0)::int)             -- penalty
  );
  _score := GREATEST(0, _score);

  _breakdown := jsonb_build_object(
    'email_verified',   _email_ok,
    'phone_verified',   _phone_ok,
    'business_verified',_biz_ok,
    'completed_sales',  _sales,
    'repeat_customers', _repeat,
    'reviews_avg',      _reviews_avg,
    'reviews_count',    _reviews_cnt,
    'years_on_platform',round(_years::numeric, 2),
    'refund_pct',       round(coalesce(_refund_pct, 0)::numeric, 2)
  );

  INSERT INTO public.ci_trust_scores (seller_id, score, breakdown, computed_at)
  VALUES (_seller_id, _score, _breakdown, now())
  ON CONFLICT (seller_id) DO UPDATE
    SET score = EXCLUDED.score,
        breakdown = EXCLUDED.breakdown,
        computed_at = now();

  RETURN _score;
END $$;

GRANT EXECUTE ON FUNCTION public.ci_compute_trust_score(UUID) TO service_role, authenticated;


-- Bulk refresh trust scores for all sellers with any listing or order
CREATE OR REPLACE FUNCTION public.ci_refresh_trust_scores()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT seller_id AS sid FROM public.listings WHERE seller_id IS NOT NULL
    UNION
    SELECT DISTINCT seller_id FROM public.ci_orders
  LOOP
    PERFORM public.ci_compute_trust_score(r.sid);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.ci_refresh_trust_scores() TO service_role, authenticated;
