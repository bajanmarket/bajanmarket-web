// Shared helpers for social sharing across the app.
// URL builders + UTM tagging + prefill copy.

export const SITE_URL = "https://bajan.market";

export type ShareSource = "listing" | "storefront" | "seller" | "my_listings" | "post_success";
export type ShareChannel = "whatsapp" | "facebook" | "x" | "instagram" | "copy" | "native";

/** Append UTM parameters to a URL. Returns the original URL on parse failure. */
export function withUtm(url: string, channel: ShareChannel, source: ShareSource): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", channel);
    u.searchParams.set("utm_medium", "share");
    u.searchParams.set("utm_campaign", `${source}_share`);
    return u.toString();
  } catch {
    return url;
  }
}

/** Ensure a path becomes a full absolute URL (using bajan.market on server / current origin on client). */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = typeof window !== "undefined" ? window.location.origin : SITE_URL;
  return `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Build the outbound share URL for each platform. */
export function shareLinks(input: { url: string; title: string; text?: string; source: ShareSource }) {
  const { title, text, source } = input;
  const message = text ?? title;

  const wa = withUtm(input.url, "whatsapp", source);
  const fb = withUtm(input.url, "facebook", source);
  const x = withUtm(input.url, "x", source);

  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message} ${wa}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fb)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(x)}`,
  };
}

/** Prefill copy based on entity type. */
export function sharePrefill(kind: ShareSource, opts: { title: string; price?: string; name?: string }): string {
  switch (kind) {
    case "listing":
    case "post_success":
    case "my_listings":
      return opts.price ? `${opts.title} — ${opts.price} on Bajan.market` : `${opts.title} on Bajan.market`;
    case "storefront":
      return `Check out ${opts.name ?? opts.title} on Bajan.market`;
    case "seller":
      return `${opts.name ?? opts.title}'s listings on Bajan.market`;
  }
}
