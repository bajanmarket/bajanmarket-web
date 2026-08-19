/**
 * Discovery of a lead's REAL public business media.
 *
 * Nothing here invents content: it only reads publicly served pages belonging to
 * the lead (their own website / public profile pages) and keeps what is actually
 * published there — image, caption, title, price, post URL and date.
 * When a page cannot be read, we return nothing rather than a substitute.
 */
import type { Db } from "@/lib/draftStore.server";

export const DRAFT_MEDIA_BUCKET = "draft-media";

export type DiscoveredPost = {
  source_url: string;
  source_platform: string | null;
  original_media_url: string | null;
  caption: string | null;
  detected_title: string | null;
  detected_price: number | null;
  detected_currency: string | null;
  posted_at: string | null;
};

export type DiscoveredMedia = {
  profile_image_url: string | null;
  cover_image_url: string | null;
  posts: DiscoveredPost[];
  pagesRead: number;
  pagesFailed: number;
};

const UA =
  "Mozilla/5.0 (compatible; BajanMarketBot/1.0; +https://bajanmarket.app) storefront-preview";

function platformFor(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("linkedin.com")) return "linkedin";
  return "website";
}

function absolutize(src: string | null | undefined, base: string): string | null {
  if (!src) return null;
  const s = src.trim();
  if (!s || s.startsWith("data:")) return null;
  try {
    return new URL(s, base).toString();
  } catch {
    return null;
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function text(v: unknown, max = 1200): string | null {
  if (typeof v !== "string") return null;
  const s = decodeEntities(v.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = re.exec(html) ?? alt.exec(html);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

async function fetchText(url: string, ms = 9000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("xml")) return null;
    const body = await res.text();
    return body.slice(0, 1_500_000);
  } catch {
    return null;
  }
}

/* ---------------- Firecrawl (renders JS pages / gets past bot walls) ---------------- */

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

function firecrawlKeys() {
  const lovable = process.env['LOVABLE_API_KEY'];
  const connection = process.env['FIRECRAWL_API_KEY'];
  return lovable && connection ? { lovable, connection } : null;
}

async function firecrawlCall<T>(path: string, body: unknown, ms = 45000): Promise<T | null> {
  const keys = firecrawlKeys();
  if (!keys) return null;
  try {
    const res = await fetch(`${FIRECRAWL_GATEWAY}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.lovable}`,
        "X-Connection-Api-Key": keys.connection,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Firecrawl ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
      return null;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(`Firecrawl ${path} error:`, err);
    return null;
  }
}

type ScrapeResult = {
  rawHtml?: string;
  html?: string;
  data?: { rawHtml?: string; html?: string };
};

/** Renders the page with Firecrawl and returns its HTML, or null when unavailable. */
async function firecrawlHtml(url: string): Promise<string | null> {
  const out = await firecrawlCall<ScrapeResult>("/scrape", {
    url,
    formats: ["rawHtml"],
    onlyMainContent: false,
    waitFor: 2500,
  });
  const html = out?.rawHtml ?? out?.html ?? out?.data?.rawHtml ?? out?.data?.html ?? null;
  return html ? html.slice(0, 1_500_000) : null;
}

const SOCIAL_HOSTS = /(facebook|instagram|tiktok|linkedin)\.com$/i;
const BAD_HOSTS =
  /(google|bing|yelp|tripadvisor|yellowpages|wikipedia|linktr|pinterest|youtube|x|twitter|threads|maps|amazon|ebay|indeed|glassdoor|bajanmarket)\./i;

/** Finds the lead's own website / social pages by name when nothing is on file. */
async function firecrawlFindUrls(businessName: string, parish?: string | null): Promise<string[]> {
  const query = [businessName, parish?.replace(/_/g, " "), "Barbados official website or Facebook page"]
    .filter(Boolean)
    .join(" ");
  const out = await firecrawlCall<{ data?: { url?: string }[]; results?: { url?: string }[] }>(
    "/search",
    { query, limit: 8, country: "bb", lang: "en" },
    30000,
  );
  const rows = out?.data ?? out?.results ?? [];
  const picked: string[] = [];
  for (const row of rows) {
    const raw = row?.url;
    if (!raw || !/^https?:\/\//i.test(raw)) continue;
    let host: string;
    try {
      host = new URL(raw).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (BAD_HOSTS.test(host) && !SOCIAL_HOSTS.test(host)) continue;
    if (picked.some((u) => new URL(u).hostname.replace(/^www\./, "") === host)) continue;
    picked.push(raw);
    if (picked.length >= 3) break;
  }
  return picked;
}


function firstImage(v: unknown, base: string): string | null {
  if (typeof v === "string") return absolutize(v, base);
  if (Array.isArray(v)) {
    for (const entry of v) {
      const hit = firstImage(entry, base);
      if (hit) return hit;
    }
    return null;
  }
  if (v && typeof v === "object") return firstImage((v as { url?: unknown }).url, base);
  return null;
}

function priceOf(node: Record<string, unknown>): { price: number | null; currency: string | null } {
  const offers = node['offers'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const raw = offer?.['price'] ?? offer?.['lowPrice'];
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[^0-9.]/g, "")) : NaN;
  const currency = typeof offer?.['priceCurrency'] === "string" ? (offer['priceCurrency'] as string) : null;
  return {
    price: Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null,
    currency,
  };
}

function walkJsonLd(node: unknown, out: Record<string, unknown>[], depth = 0) {
  if (depth > 6 || !node) return;
  if (Array.isArray(node)) {
    for (const n of node) walkJsonLd(n, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  out.push(obj);
  for (const key of ["@graph", "itemListElement", "item", "hasPart", "mainEntity"]) {
    if (obj[key]) walkJsonLd(obj[key], out, depth + 1);
  }
}

/** Extracts real published items from one public page belonging to the lead. */
function extractPage(html: string, pageUrl: string) {
  const platform = platformFor(pageUrl);
  const posts: DiscoveredPost[] = [];
  const seen = new Set<string>();

  const nodes: Record<string, unknown>[] = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html))) {
    try {
      walkJsonLd(JSON.parse(m[1] as string), nodes);
    } catch {
      /* malformed JSON-LD is simply skipped */
    }
  }

  for (const node of nodes) {
    const type = String(node['@type'] ?? "").toLowerCase();
    const isItem = /product|service|offer|article|socialmediaposting|imageobject|creativework/.test(type);
    if (!isItem) continue;
    const title = text(node['name'] ?? node['headline'], 120);
    const image = firstImage(node['image'] ?? node['thumbnailUrl'] ?? node['contentUrl'], pageUrl);
    if (!title && !image) continue;
    const { price, currency } = priceOf(node);
    const url = absolutize(typeof node['url'] === "string" ? node['url'] : null, pageUrl) ?? pageUrl;
    const key = `${image ?? ""}|${title ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      source_url: url,
      source_platform: platform,
      original_media_url: image,
      caption: text(node['description'] ?? node['articleBody']),
      detected_title: title,
      detected_price: price,
      detected_currency: currency,
      posted_at:
        typeof node['datePublished'] === "string" && !Number.isNaN(Date.parse(node['datePublished']))
          ? new Date(node['datePublished']).toISOString()
          : null,
    });
  }

  // Only when the page publishes no structured items do we fall back to the
  // page's own visible imagery — still the business's real photos.
  if (posts.length === 0) {
    const imgRe = /<img[^>]+>/gi;
    let tag: RegExpExecArray | null;
    while ((tag = imgRe.exec(html)) && posts.length < 12) {
      const raw = tag[0];
      const srcMatch =
        /(?:data-src|data-lazy-src|srcset|src)=["']([^"']+)["']/i.exec(raw)?.[1] ?? null;
      const src = absolutize(srcMatch?.split(/\s+/)[0] ?? null, pageUrl);
      if (!src) continue;
      if (/\.svg(\?|$)/i.test(src)) continue;
      if (/(sprite|icon|logo|avatar|placeholder|pixel|blank|spacer|badge|flag)/i.test(src)) continue;
      if (seen.has(src)) continue;
      seen.add(src);
      const alt = text(/alt=["']([^"']*)["']/i.exec(raw)?.[1] ?? null, 120);
      posts.push({
        source_url: pageUrl,
        source_platform: platform,
        original_media_url: src,
        caption: alt,
        detected_title: alt,
        detected_price: null,
        detected_currency: null,
        posted_at: null,
      });
    }
  }

  return {
    ogImage: absolutize(metaContent(html, "og:image") ?? metaContent(html, "twitter:image"), pageUrl),
    logo: firstImage(
      nodes.find((n) => n['logo'])?.['logo'],
      pageUrl,
    ),
    posts,
  };
}

/** Reads the lead's own public pages and returns only what is genuinely published there. */
export async function discoverProspectMedia(
  p: {
    website_url?: string | null;
    facebook_url?: string | null;
    instagram_url?: string | null;
    other_source_url?: string | null;
    profile_image_url?: string | null;
    cover_image_url?: string | null;
  },
  maxPosts = 12,
): Promise<DiscoveredMedia> {
  const urls = [p.website_url, p.facebook_url, p.instagram_url, p.other_source_url]
    .filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)))
    .slice(0, 4);

  let profile = p.profile_image_url ?? null;
  let cover = p.cover_image_url ?? null;
  const posts: DiscoveredPost[] = [];
  let pagesRead = 0;
  let pagesFailed = 0;

  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) {
      pagesFailed += 1;
      continue;
    }
    pagesRead += 1;
    const page = extractPage(html, url);
    if (!profile) profile = page.logo ?? page.ogImage;
    if (!cover) cover = page.ogImage;
    for (const post of page.posts) {
      if (posts.length >= maxPosts) break;
      if (post.original_media_url && posts.some((x) => x.original_media_url === post.original_media_url)) continue;
      posts.push(post);
    }
  }

  return { profile_image_url: profile, cover_image_url: cover, posts, pagesRead, pagesFailed };
}

/* ---------------- media ingestion (permanent BajanMarket copy) ---------------- */

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Copies a permitted public image into BajanMarket storage so the preview never
 * depends on an expiring or hotlink-blocked social URL.
 * Returns the storage path, or null when the media cannot be persisted.
 */
export async function ingestMedia(db: Db, sourceUrl: string, prospectId: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": UA, Accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    const ext = EXT[type];
    if (!ext) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1024 || buf.byteLength > 8 * 1024 * 1024) return null;

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceUrl));
    const name = Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
    const path = `${prospectId}/${name}.${ext}`;

    const { error } = await db.storage
      .from(DRAFT_MEDIA_BUCKET)
      .upload(path, buf, { contentType: type, upsert: true });
    if (error && !/exists/i.test(error.message)) return null;
    return path;
  } catch {
    return null;
  }
}

/** Signs stored media paths for display (private bucket). */
export async function signMedia(db: Db, paths: (string | null | undefined)[], seconds = 60 * 60 * 24 * 7) {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await db.storage.from(DRAFT_MEDIA_BUCKET).createSignedUrls(unique, seconds);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

/**
 * Moves an imported draft image into the merchant's own listings storage when the
 * storefront is published, so the real photo survives the claim.
 * Returns a long-lived signed URL, or null when the copy is not possible.
 */
export async function publishStoredMedia(db: Db, path: string, userId: string): Promise<string | null> {
  try {
    const { data: file, error } = await db.storage.from(DRAFT_MEDIA_BUCKET).download(path);
    if (error || !file) return null;
    const ext = path.split(".").pop() ?? "jpg";
    const target = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await db.storage.from("listings").upload(target, bytes, {
      contentType: file.type || "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (upErr) return null;
    const { data: signed } = await db.storage.from("listings").createSignedUrl(target, 60 * 60 * 24 * 365 * 10);
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** True when a stored value is a draft-media storage path rather than an external URL. */
export function isStoredPath(value?: string | null): value is string {
  return Boolean(value && !/^https?:\/\//i.test(value) && !value.startsWith("/"));
}
