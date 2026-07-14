// Commerce Intelligence — client-side event tracking helper.
// Uses the existing `ci_log_event` RPC (SECURITY DEFINER, rate-limited server side)
// so we don't need a bespoke HTTP beacon route. Fire-and-forget.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "bm_ci_session";

/** Stable per-tab session id used to de-dupe visitors in analytics. */
function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

/** Very cheap device/browser sniff — good enough for aggregate stats. */
function deviceInfo() {
  if (typeof navigator === "undefined") return { device: "server", browser: "server" };
  const ua = navigator.userAgent || "";
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
  const browser =
    /Edg\//.test(ua) ? "edge" :
    /Chrome\//.test(ua) ? "chrome" :
    /Firefox\//.test(ua) ? "firefox" :
    /Safari\//.test(ua) ? "safari" : "other";
  return { device, browser };
}

export type CiEventType =
  | "PageViewed"
  | "ListingViewed"
  | "ListingShared"
  | "SellerProfileViewed"
  | "BusinessViewed"
  | "MessageSent"
  | "MessageReceived"
  | "ProductSaved"
  | "CheckoutStarted"
  | "OrderCompleted"
  | "CampaignVisited"
  | "SearchPerformed";

export interface CiEventPayload {
  sellerId?: string | null;
  listingId?: string | null;
  businessId?: string | null;
  categoryId?: string | null;
  campaignCode?: string | null;
  parish?: string | null;
  metadata?: Record<string, unknown>;
}

/** Emit a single analytics event. Never throws. */
export function emitEvent(type: CiEventType, payload: CiEventPayload = {}) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const source = url.searchParams.get("utm_source");
    const medium = url.searchParams.get("utm_medium");
    const campaign = payload.campaignCode ?? url.searchParams.get("utm_campaign");
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    const info = deviceInfo();

    // Fire-and-forget; ignore result. Rate limiting happens server-side.
    void supabase.rpc("ci_log_event", {
      _event_type: type,
      _seller_id: payload.sellerId ?? null,
      _listing_id: payload.listingId ?? null,
      _business_id: payload.businessId ?? null,
      _category_id: payload.categoryId ?? null,
      _campaign_code: campaign ?? null,
      _session_id: sessionId(),
      _source: source,
      _medium: medium,
      _referrer: referrer || null,
      _path: url.pathname,
      _parish: payload.parish ?? null,
      _device: info.device,
      _browser: info.browser,
      _metadata: (payload.metadata ?? {}) as never,
    });
  } catch {
    /* swallow — analytics must never break the app */
  }
}
