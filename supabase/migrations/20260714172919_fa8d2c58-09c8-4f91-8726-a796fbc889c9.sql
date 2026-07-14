
-- Correct the category stats function: listings.price is numeric currency units,
-- not cents. Multiply by 100 when storing into *_cents columns for consistency.
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
    (avg(l.price) * 100)::bigint,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price) * 100)::bigint,
    count(*) FILTER (WHERE l.status = 'active'),
    coalesce((SELECT count(*) FROM public.ci_events e
              WHERE e.category_id = l.category_id
                AND e.event_type = 'ListingViewed'
                AND e.occurred_at > now() - interval '7 days'), 0)::numeric,
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price) * 100)::bigint
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
