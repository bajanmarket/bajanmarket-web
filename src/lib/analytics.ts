// Lightweight analytics fan-out to GA4 + Meta Pixel.
// Silent no-op on SSR and when scripts haven't loaded.

export const GA4_ID = "G-7M59V1QNZS";
export const META_PIXEL_ID = (import.meta.env?.VITE_META_PIXEL_ID as string | undefined) ?? "";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Map custom event -> standard Meta pixel event (if applicable)
const META_STANDARD: Record<string, string> = {
  account_created: "CompleteRegistration",
  listing_viewed: "ViewContent",
  search_performed: "Search",
  seller_contacted: "Contact",
  listing_created: "SubmitApplication",
  listing_shared: "Share",
  listing_saved: "AddToWishlist",
};

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch { /* noop */ }
  try {
    const std = META_STANDARD[event];
    if (std) window.fbq?.("track", std, params);
    else window.fbq?.("trackCustom", event, params);
  } catch { /* noop */ }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", "page_view", { page_path: path, page_location: window.location.href });
  } catch { /* noop */ }
  try {
    window.fbq?.("track", "PageView");
  } catch { /* noop */ }
}

export function deviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}
