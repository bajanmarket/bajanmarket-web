/** Single source of truth for public brand + canonical URLs. */
export const SITE_URL = "https://bajanmarket.app";
export const BRAND = "BajanMarket";
export const BRAND_TAGLINE = "Barbados' cleaner marketplace";

export const absUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

/** Robots meta for private / internal-only pages. */
export const NOINDEX = { name: "robots", content: "noindex, nofollow" };
