/**
 * firecrawlService — the only place Firecrawl is called from.
 *
 * Server-side only. The Firecrawl connection is gateway-backed, so requests go
 * through the Lovable connector gateway with the connection key; the raw
 * provider key is never present in this project and never reaches the browser.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type FirecrawlStatus =
  | "success"
  | "partial"
  | "blocked"
  | "no_content"
  | "failed"
  | "rate_limited"
  | "timeout"
  | "not_configured";

export type FirecrawlCall<T> = { status: FirecrawlStatus; data: T | null; error: string | null };

function keys() {
  const lovable = process.env['LOVABLE_API_KEY'];
  const connection = process.env['FIRECRAWL_API_KEY'];
  return lovable && connection ? { lovable, connection } : null;
}

export function firecrawlConfigured() {
  return keys() !== null;
}

async function call<T>(path: string, body: unknown, ms: number): Promise<FirecrawlCall<T>> {
  const k = keys();
  if (!k) return { status: "not_configured", data: null, error: "Firecrawl is not connected" };
  try {
    const res = await fetch(`${GATEWAY}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${k.lovable}`,
        "X-Connection-Api-Key": k.connection,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Firecrawl ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
      const status: FirecrawlStatus =
        res.status === 429 ? "rate_limited" : res.status === 403 || res.status === 401 ? "blocked" : "failed";
      return { status, data: null, error: `Firecrawl ${res.status}: ${text.slice(0, 300)}` };
    }
    return { status: "success", data: JSON.parse(text) as T, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /timeout|abort/i.test(message);
    console.error(`Firecrawl ${path} error:`, message);
    return { status: timedOut ? "timeout" : "failed", data: null, error: message.slice(0, 300) };
  }
}

/* ---------------- extraction schema ---------------- */

/** Normalized BajanMarket shape Firecrawl is asked to fill from the page. */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    business: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        whatsapp: { type: "string" },
        address: { type: "string" },
        parish: { type: "string" },
        opening_hours: { type: "array", items: { type: "string" } },
        logo_url: { type: "string" },
        cover_image_url: { type: "string" },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["product", "service", "promotion", "event", "unknown"] },
          description: { type: "string" },
          price: { type: ["number", "null"] },
          currency: { type: "string" },
          image_url: { type: "string" },
          source_url: { type: "string" },
          availability: { type: "string" },
          category: { type: "string" },
        },
      },
    },
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caption: { type: "string" },
          image_url: { type: "string" },
          date: { type: "string" },
          source_url: { type: "string" },
        },
      },
    },
  },
} as const;

export type ExtractedBusiness = {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  parish?: string;
  opening_hours?: string[];
  logo_url?: string;
  cover_image_url?: string;
};

export type ExtractedItem = {
  name?: string;
  type?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  image_url?: string;
  source_url?: string;
  availability?: string;
  category?: string;
};

export type ExtractedPost = { caption?: string; image_url?: string; date?: string; source_url?: string };

export type Extraction = { business?: ExtractedBusiness; items?: ExtractedItem[]; posts?: ExtractedPost[] };

export type ScrapePayload = {
  markdown: string | null;
  rawHtml: string | null;
  links: string[];
  json: Extraction | null;
};

type ScrapeRaw = {
  markdown?: string;
  rawHtml?: string;
  html?: string;
  links?: string[];
  json?: Extraction;
  data?: { markdown?: string; rawHtml?: string; html?: string; links?: string[]; json?: Extraction };
};

/** Scrapes one page and asks Firecrawl to structure it into the BajanMarket shape. */
export async function firecrawlScrape(url: string): Promise<FirecrawlCall<ScrapePayload>> {
  const out = await call<ScrapeRaw>(
    "/scrape",
    {
      url,
      formats: [
        "markdown",
        "rawHtml",
        "links",
        {
          type: "json",
          schema: EXTRACTION_SCHEMA,
          prompt:
            "Extract only what this page actually publishes about the business and the products/services it offers. Never invent a price, product, service, contact detail or image. Leave a field out when the page does not state it. Use the exact image URL shown for each item — never reuse another item's image.",
        },
      ],
      onlyMainContent: false,
      waitFor: 2500,
    },
    60000,
  );

  if (!out.data) return { status: out.status, data: null, error: out.error };
  const d = out.data.data ?? out.data;
  const payload: ScrapePayload = {
    markdown: d.markdown ? d.markdown.slice(0, 200_000) : null,
    rawHtml: (d.rawHtml ?? d.html)?.slice(0, 1_500_000) ?? null,
    links: Array.isArray(d.links) ? d.links.slice(0, 500) : [],
    json: d.json ?? null,
  };
  const empty = !payload.markdown && !payload.rawHtml && !payload.json;
  return { status: empty ? "no_content" : "success", data: payload, error: null };
}

/** Lists the URLs of a website so we can pick catalogue/product/service pages. */
export async function firecrawlMap(url: string, search?: string): Promise<FirecrawlCall<string[]>> {
  const out = await call<{ links?: unknown[]; data?: { links?: unknown[] } }>(
    "/map",
    { url, search, limit: 300, includeSubdomains: false },
    45000,
  );
  if (!out.data) return { status: out.status, data: null, error: out.error };
  const raw = out.data.links ?? out.data.data?.links ?? [];
  const links = raw
    .map((l) => (typeof l === "string" ? l : ((l as { url?: string })?.url ?? null)))
    .filter((l): l is string => Boolean(l && /^https?:\/\//i.test(l)));
  return { status: links.length ? "success" : "no_content", data: links, error: null };
}

/** Finds a lead's own public pages by name when nothing is on file. */
export async function firecrawlSearch(query: string): Promise<FirecrawlCall<string[]>> {
  type Hit = { url?: string };
  const out = await call<{ data?: Hit[] | { web?: Hit[] }; results?: Hit[] }>(
    "/search",
    { query, limit: 8, country: "bb", lang: "en" },
    35000,
  );
  if (!out.data) return { status: out.status, data: null, error: out.error };
  const d = out.data.data;
  const rows: Hit[] = Array.isArray(d) ? d : (d?.web ?? out.data.results ?? []);
  const urls = rows.map((r) => r?.url).filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)));
  return { status: urls.length ? "success" : "no_content", data: urls, error: null };
}
