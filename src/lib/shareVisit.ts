// Capture inbound share visits. Runs once per pageview when utm_source is present.
import { supabase } from "@/integrations/supabase/client";

const SEEN = new Set<string>();

export function captureShareVisit() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const source = url.searchParams.get("utm_source");
    if (!source) return;
    const key = url.pathname + "?" + source;
    if (SEEN.has(key)) return;
    SEEN.add(key);

    const medium = url.searchParams.get("utm_medium") ?? "";
    const campaign = url.searchParams.get("utm_campaign") ?? "";
    const referrer = typeof document !== "undefined" ? document.referrer : "";

    supabase.rpc("log_share_visit", {
      _path: url.pathname,
      _utm_source: source,
      _utm_medium: medium,
      _utm_campaign: campaign,
      _referrer: referrer,
    }).then(() => { /* fire and forget */ });
  } catch {
    /* ignore */
  }
}
