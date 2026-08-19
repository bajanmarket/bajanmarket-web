/**
 * ContentSourceManager — turns a lead's public web presence into normalized
 * BajanMarket `discovered_content` records.
 *
 * Architecture (all adapters emit the same normalized record):
 *   OpportunityScanner -> ContentSourceManager -> [FirecrawlWebSource | future MetaSource | ManualSource]
 *                      -> ContentNormalizer -> discovered_content -> draft listings -> existing preview
 *
 * Nothing here invents content: every record keeps the source URL, source type,
 * platform, extraction date and confidence it came from.
 */
import type { Db, ProspectRow } from "@/lib/draftStore.server";
import { DRAFT_MEDIA_BUCKET } from "@/lib/draftMedia.server";
import {
  firecrawlConfigured,
  firecrawlMap,
  firecrawlScrape,
  firecrawlSearch,
  type Extraction,
  type FirecrawlStatus,
} from "@/lib/firecrawl.server";

export type SourceType =
  | "website"
  | "catalogue"
  | "product_page"
  | "service_page"
  | "menu"
  | "social"
  | "directory"
  | "other";

export type NormalizedContent = {
  content_type: "product" | "service" | "promotion" | "event" | "update" | "unknown";
  title: string | null;
  original_text: string | null;
  cleaned_text: string | null;
  detected_price: number | null;
  currency: string;
  original_image_url: string | null;
  source_url: string;
  source_platform: string | null;
  source_date: string | null;
};

const UA =
  "Mozilla/5.0 (compatible; BajanMarketBot/1.0; +https://bajanmarket.app) storefront-preview";

/* ---------------- URL helpers ---------------- */

const GOOD_PATH = /\/(products?|shop|store|services?|menu|catalog(ue)?|collections?|inventory|offerings|gallery)(\/|$|\?)/i;
const BAD_PATH =
  /\/(privacy|terms|legal|careers?|jobs|login|signin|signup|account|cart|checkout|blog\/\d|tag|author|wp-|feed|sitemap|search|faq|returns?|shipping|cookie)/i;
const SOCIAL_HOST = /(facebook|instagram|tiktok|linkedin)\.com$/i;
const BAD_HOST =
  /(google|bing|yelp|tripadvisor|yellowpages|wikipedia|linktr|pinterest|youtube|twitter|threads|maps|amazon|ebay|indeed|glassdoor|bajanmarket)\./i;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function platformFor(url: string): string {
  const h = hostOf(url);
  if (h.includes("facebook.com")) return "facebook";
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("tiktok.com")) return "tiktok";
  if (h.includes("linkedin.com")) return "linkedin";
  return "website";
}

export function typeFor(url: string): SourceType {
  if (SOCIAL_HOST.test(hostOf(url))) return "social";
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/menu/.test(path)) return "menu";
  if (/service/.test(path)) return "service_page";
  if (/(catalog|collections?|shop|store|inventory)/.test(path)) return "catalogue";
  if (/products?\//.test(path)) return "product_page";
  if (path === "" || path === "/") return "website";
  return "other";
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

function clean(v: unknown, max = 1200): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : null;
}

function priceOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

/* ---------------- source discovery ---------------- */

/** Records (and returns) every source URL we can legitimately try for this lead. */
export async function discoverLeadSources(db: Db, p: ProspectRow) {
  const candidates: string[] = [p.website_url, p.facebook_url, p.instagram_url, p.other_source_url].filter(
    (u): u is string => Boolean(u && /^https?:\/\//i.test(u)),
  );

  // Nothing on file: let Firecrawl find the lead's own pages by name.
  const found: string[] = [];
  if (!candidates.length && p.business_name && firecrawlConfigured()) {
    const query = [p.business_name, p.parish?.replace(/_/g, " "), "Barbados official website or Facebook page"]
      .filter(Boolean)
      .join(" ");
    const search = await firecrawlSearch(query);
    for (const url of search.data ?? []) {
      const h = hostOf(url);
      if (!h || (BAD_HOST.test(h) && !SOCIAL_HOST.test(h))) continue;
      if (found.some((u) => hostOf(u) === h)) continue;
      found.push(url);
      if (found.length >= 3) break;
    }
    candidates.push(...found);
  }

  // Websites: map the site and add its catalogue/product/service pages.
  for (const url of [...candidates]) {
    if (SOCIAL_HOST.test(hostOf(url))) continue;
    const mapped = await firecrawlMap(url, "products services menu shop catalogue");
    const picked = (mapped.data ?? [])
      .filter((u) => hostOf(u) === hostOf(url))
      .filter((u) => GOOD_PATH.test(u) && !BAD_PATH.test(u))
      .slice(0, 8);
    for (const u of picked) if (!candidates.includes(u)) candidates.push(u);
  }

  const unique = Array.from(new Set(candidates)).slice(0, 12);
  for (const source_url of unique) {
    await db
      .from("lead_sources")
      .upsert(
        {
          lead_id: p.id,
          source_url,
          source_type: typeFor(source_url),
          source_platform: platformFor(source_url),
        },
        { onConflict: "lead_id,source_url", ignoreDuplicates: true },
      );
  }

  const { data: rows } = await db.from("lead_sources").select("*").eq("lead_id", p.id).order("created_at");
  return { sources: rows ?? [], discoveredUrls: found };
}

/* ---------------- image pipeline ---------------- */

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const JUNK_IMAGE =
  /(sprite|icon|favicon|logo|avatar|placeholder|pixel|blank|spacer|badge|flag|payment|visa|mastercard|paypal|banner-ad|advert|loading|arrow|chevron|star-rating|social)/i;

/** Cheap URL-level rejection of icons, pixels and chrome before any download. */
export function plausibleImageUrl(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  if (JUNK_IMAGE.test(url)) return false;
  // Explicit tiny dimensions in the URL (e.g. 32x32, w=48)
  const dim = /(\d{2,4})[x×](\d{2,4})/.exec(url);
  if (dim && Number(dim[1]) < 200 && Number(dim[2]) < 200) return false;
  const w = /[?&](w|width)=(\d{1,4})/i.exec(url);
  if (w && Number(w[2]) < 200) return false;
  return true;
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type StoredImage = { path: string; hash: string };

/**
 * Downloads, validates and stores a permitted business image in BajanMarket
 * storage. Returns null when the media is missing, tiny, not an image, or
 * cannot be persisted — the caller then keeps the original URL only.
 */
export async function storeImage(db: Db, sourceUrl: string, leadId: string): Promise<StoredImage | null> {
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
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Under 8KB is almost always an icon/tracking asset; over 8MB is not usable.
    if (bytes.byteLength < 8 * 1024 || bytes.byteLength > 8 * 1024 * 1024) return null;

    const hash = await sha256(bytes);
    const path = `${leadId}/${hash.slice(0, 24)}.${ext}`;
    const { error } = await db.storage
      .from(DRAFT_MEDIA_BUCKET)
      .upload(path, bytes, { contentType: type, upsert: true });
    if (error && !/exists/i.test(error.message)) return null;
    return { path, hash };
  } catch {
    return null;
  }
}

/* ---------------- normalization ---------------- */

function confidenceFor(c: NormalizedContent): "high" | "medium" | "low" {
  const hasTitle = Boolean(c.title && c.title.length > 2);
  const hasImage = Boolean(c.original_image_url);
  const hasPrice = c.detected_price !== null;
  const hasText = Boolean(c.cleaned_text && c.cleaned_text.length > 30);
  if (hasTitle && hasImage && (hasPrice || hasText)) return "high";
  if (hasTitle && (hasImage || hasPrice || hasText)) return "medium";
  return "low";
}

/** Firecrawl structured output -> normalized records, image bound to its own item. */
function normalizeExtraction(extraction: Extraction, pageUrl: string): NormalizedContent[] {
  const platform = platformFor(pageUrl);
  const out: NormalizedContent[] = [];

  for (const item of extraction.items ?? []) {
    const title = clean(item.name, 120);
    const image = absolutize(item.image_url ?? null, pageUrl);
    if (!title) continue;
    const type = (item.type ?? "unknown").toLowerCase();
    out.push({
      content_type:
        type === "product" || type === "service" || type === "promotion" || type === "event"
          ? (type as NormalizedContent["content_type"])
          : "unknown",
      title,
      original_text: clean(item.description, 2000),
      cleaned_text: clean(item.description, 1200),
      detected_price: priceOf(item.price),
      currency: (item.currency ?? "BBD").toUpperCase().slice(0, 6),
      original_image_url: plausibleImageUrl(image) ? image : null,
      source_url: absolutize(item.source_url ?? null, pageUrl) ?? pageUrl,
      source_platform: platform,
      source_date: null,
    });
  }

  for (const post of extraction.posts ?? []) {
    const caption = clean(post.caption, 1200);
    const image = absolutize(post.image_url ?? null, pageUrl);
    if (!caption && !image) continue;
    const date = post.date && !Number.isNaN(Date.parse(post.date)) ? new Date(post.date).toISOString() : null;
    out.push({
      content_type: "update",
      title: caption ? caption.slice(0, 120) : null,
      original_text: caption,
      cleaned_text: caption,
      detected_price: null,
      currency: "BBD",
      original_image_url: plausibleImageUrl(image) ? image : null,
      source_url: absolutize(post.source_url ?? null, pageUrl) ?? pageUrl,
      source_platform: platform,
      source_date: date,
    });
  }

  return out;
}

/* ---------------- lead enrichment (never overwrites known data) ---------------- */

function firstNonEmpty(...vals: (string | null | undefined)[]) {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return null;
}

type ProspectPatch = Database["public"]["Tables"]["seller_prospects"]["Update"];

async function enrichLead(db: Db, p: ProspectRow, business: Extraction["business"] | undefined) {
  if (!business) return;
  const patch: ProspectPatch = {};
  const take = (current: unknown, incoming?: string) => {
    const value = firstNonEmpty(incoming);
    return value && !current ? value.slice(0, 400) : undefined;
  };
  patch.business_description = take(p.business_description, business.description);
  patch.public_phone = take(p.public_phone, business.phone);
  patch.public_email = take(p.public_email, business.email);
  patch.public_whatsapp = take(p.public_whatsapp, business.whatsapp);
  patch.address = take(p.address, business.address);
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as ProspectPatch;
  if (Object.keys(clean).length) await db.from("seller_prospects").update(clean).eq("id", p.id);
}


/* ---------------- the web adapter ---------------- */

export type ScanSummary = {
  status: "content_found" | "partial" | "no_usable_content" | "failed" | "not_configured";
  sourcesFound: number;
  sourcesScanned: number;
  products: number;
  services: number;
  imagesFound: number;
  usableImages: number;
  contactFound: boolean;
  lastScan: string | null;
  note: string | null;
};

const RESCAN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Scans a lead's sources through Firecrawl and stores normalized discovered
 * content. Sources scanned recently are skipped unless `force` is set, so
 * repeated previews never spend credits.
 */
export async function scanLeadWebSources(db: Db, p: ProspectRow, force = false): Promise<ScanSummary> {
  if (!firecrawlConfigured()) {
    return {
      status: "not_configured",
      sourcesFound: 0,
      sourcesScanned: 0,
      products: 0,
      services: 0,
      imagesFound: 0,
      usableImages: 0,
      contactFound: false,
      lastScan: null,
      note: "Firecrawl is not connected",
    };
  }

  const { sources, discoveredUrls } = await discoverLeadSources(db, p);

  // Keep newly found pages on the lead record for future runs.
  if (discoveredUrls.length) {
    const patch: ProspectPatch = {};
    for (const url of discoveredUrls) {
      const h = hostOf(url);
      if (h.includes("facebook.com")) patch['facebook_url'] ??= url;
      else if (h.includes("instagram.com")) patch['instagram_url'] ??= url;
      else patch['website_url'] ??= url;
    }
    if (Object.keys(patch).length) await db.from("seller_prospects").update(patch).eq("id", p.id);
  }

  let scanned = 0;
  let imagesFound = 0;
  let usableImages = 0;
  let contactFound = false;
  const statuses: FirecrawlStatus[] = [];

  for (const source of sources) {
    const fresh =
      !force &&
      source.last_scanned_at &&
      Date.now() - new Date(source.last_scanned_at).getTime() < RESCAN_AFTER_MS;
    if (fresh) continue;

    await db.from("lead_sources").update({ scan_status: "scanning", error_message: null }).eq("id", source.id);

    const result = await firecrawlScrape(source.source_url);
    statuses.push(result.status);

    if (!result.data) {
      await db
        .from("lead_sources")
        .update({
          scan_status: result.status === "blocked" ? "blocked" : "failed",
          firecrawl_status: result.status,
          extraction_status: "none",
          error_message: result.error,
          last_scanned_at: new Date().toISOString(),
        })
        .eq("id", source.id);
      continue;
    }

    scanned += 1;
    const extraction = result.data.json ?? {};
    if (extraction.business) {
      contactFound ||= Boolean(extraction.business.phone || extraction.business.email || extraction.business.whatsapp);
      await enrichLead(db, p, extraction.business);
    }

    const records = normalizeExtraction(extraction, source.source_url);
    let stored = 0;
    for (const record of records) {
      let storedPath: string | null = null;
      let hash: string | null = null;
      if (record.original_image_url) {
        imagesFound += 1;
        const image = await storeImage(db, record.original_image_url, p.id);
        if (image) {
          storedPath = image.path;
          hash = image.hash;
          usableImages += 1;
          stored += 1;
        }
      }

      const confidence = confidenceFor(record);
      const { error } = await db.from("discovered_content").upsert(
        {
          lead_id: p.id,
          source_id: source.id,
          source_url: record.source_url,
          source_platform: record.source_platform,
          content_type: record.content_type,
          title: record.title,
          original_text: record.original_text,
          cleaned_text: record.cleaned_text,
          detected_price: record.detected_price,
          currency: record.currency,
          original_image_url: record.original_image_url,
          stored_image_url: storedPath,
          image_hash: hash,
          source_date: record.source_date,
          extraction_confidence: confidence,
          extraction_status: "extracted",
        },
        { onConflict: "lead_id,image_hash", ignoreDuplicates: true },
      );
      // Records without an image dedupe on (lead, source_url, title) instead.
      if (error && !hash) {
        await db.from("discovered_content").upsert(
          {
            lead_id: p.id,
            source_id: source.id,
            source_url: record.source_url,
            source_platform: record.source_platform,
            content_type: record.content_type,
            title: record.title,
            original_text: record.original_text,
            cleaned_text: record.cleaned_text,
            detected_price: record.detected_price,
            currency: record.currency,
            extraction_confidence: confidence,
            extraction_status: "extracted",
          },
          { onConflict: "lead_id,source_url,title", ignoreDuplicates: true },
        );
      }
    }

    await db
      .from("lead_sources")
      .update({
        scan_status: records.length ? "content_found" : "no_content",
        firecrawl_status: result.status,
        extraction_status: records.length ? "extracted" : "none",
        items_found: records.length,
        images_found: stored,
        error_message: null,
        last_scanned_at: new Date().toISOString(),
      })
      .eq("id", source.id);
  }

  return summariseLead(db, p.id, {
    scanned,
    imagesFound,
    usableImages,
    contactFound,
    statuses,
    sourcesFound: sources.length,
  });
}

/** Reads current stored state for the lead — never calls Firecrawl. */
export async function summariseLead(
  db: Db,
  leadId: string,
  live?: {
    scanned: number;
    imagesFound: number;
    usableImages: number;
    contactFound: boolean;
    statuses: FirecrawlStatus[];
    sourcesFound: number;
  },
): Promise<ScanSummary> {
  const { data: sources } = await db.from("lead_sources").select("*").eq("lead_id", leadId);
  const { data: content } = await db.from("discovered_content").select("*").eq("lead_id", leadId);
  const rows = content ?? [];
  const scannedSources = (sources ?? []).filter((s) => s.last_scanned_at);
  const lastScan =
    scannedSources
      .map((s) => s.last_scanned_at as string)
      .sort()
      .pop() ?? null;

  const usable = rows.filter((r) => r.stored_image_url).length;
  const failed = (sources ?? []).filter((s) => s.scan_status === "failed" || s.scan_status === "blocked").length;

  let status: ScanSummary["status"];
  if (!sources?.length) status = "failed";
  else if (rows.length && failed) status = "partial";
  else if (rows.length) status = "content_found";
  else if (scannedSources.length) status = "no_usable_content";
  else status = "failed";

  return {
    status,
    sourcesFound: live?.sourcesFound ?? sources?.length ?? 0,
    sourcesScanned: scannedSources.length,
    products: rows.filter((r) => r.content_type === "product" || r.content_type === "unknown").length,
    services: rows.filter((r) => r.content_type === "service").length,
    imagesFound: rows.filter((r) => r.original_image_url).length,
    usableImages: usable,
    contactFound: live?.contactFound ?? false,
    lastScan,
    note: live && live.statuses.includes("rate_limited") ? "Firecrawl rate limited some pages" : null,
  };
}
