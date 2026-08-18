import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;
export type ProspectRow = Database["public"]["Tables"]["seller_prospects"]["Row"];
export type DraftStoreRow = Database["public"]["Tables"]["draft_stores"]["Row"];

/* ---------------- shared helpers ---------------- */

export async function assertAdmin(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export async function claimAudit(
  db: Db,
  event: string,
  args: {
    draftStoreId?: string | null;
    prospectId?: string | null;
    actorUserId?: string | null;
    detail?: Record<string, unknown>;
  } = {},
) {
  await db.from("store_claim_audit").insert({
    draft_store_id: args.draftStoreId ?? null,
    prospect_id: args.prospectId ?? null,
    event,
    actor_user_id: args.actorUserId ?? null,
    detail: (args.detail ?? {}) as never,
  });
}

/* ---------------- claim tokens ---------------- */

export function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates a fresh claim token, revoking any earlier live tokens for the store. */
export async function issueClaimToken(db: Db, draftStoreId: string, createdBy: string | null, days = 45) {
  await db
    .from("store_claim_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("draft_store_id", draftStoreId)
    .is("revoked_at", null)
    .is("claimed_at", null);

  const token = generateToken();
  const token_hash = await hashToken(token);
  const { error } = await db.from("store_claim_tokens").insert({
    draft_store_id: draftStoreId,
    token_hash,
    token_hint: token.slice(0, 6),
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    created_by: createdBy,
  });
  if (error) throw error;
  return token;
}

export type TokenLookup =
  | { ok: false; reason: string }
  | { ok: true; token: Database["public"]["Tables"]["store_claim_tokens"]["Row"]; store: DraftStoreRow };

export async function lookupToken(db: Db, rawToken: string): Promise<TokenLookup> {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return { ok: false, reason: "This claim link is not valid." };
  const token_hash = await hashToken(rawToken);
  const { data: token } = await db
    .from("store_claim_tokens")
    .select("*")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (!token) return { ok: false, reason: "This claim link is not valid." };
  if (token.revoked_at) return { ok: false, reason: "This claim link has been revoked." };
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now())
    return { ok: false, reason: "This claim link has expired. Ask us for a fresh one." };
  const { data: store } = await db.from("draft_stores").select("*").eq("id", token.draft_store_id).maybeSingle();
  if (!store) return { ok: false, reason: "This storefront is no longer available." };
  return { ok: true, token, store };
}

/* ---------------- slugs & duplicates ---------------- */

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uniqueSlug(db: Db, base: string, ignoreDraftId?: string) {
  const root = slugify(base) || "store";
  for (let i = 0; i < 40; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data: biz } = await db.from("businesses").select("id").eq("slug", candidate).maybeSingle();
    if (biz) continue;
    const { data: draft } = await db.from("draft_stores").select("id").eq("slug", candidate).maybeSingle();
    if (draft && draft.id !== ignoreDraftId) continue;
    return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

const norm = (v?: string | null) =>
  (v ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]/g, "");

/** Looks for a live business storefront that probably already belongs to this lead. */
export async function findExistingBusiness(db: Db, p: ProspectRow) {
  const { data } = await db
    .from("businesses")
    .select("id, name, slug, owner_id, contact_email, contact_phone, whatsapp, website, address, status")
    .limit(2000);
  const keys = {
    name: norm(p.business_name),
    email: norm(p.public_email),
    phone: norm(p.public_phone),
    whatsapp: norm(p.public_whatsapp),
    site: norm(p.website_url),
    address: norm(p.address),
  };
  for (const b of data ?? []) {
    const on: string[] = [];
    if (keys.name && norm(b.name) === keys.name) on.push("business name");
    if (keys.email && norm(b.contact_email) === keys.email) on.push("email");
    if (keys.phone && norm(b.contact_phone) === keys.phone) on.push("phone");
    if (keys.whatsapp && norm(b.whatsapp) === keys.whatsapp) on.push("WhatsApp");
    if (keys.site && keys.site === norm(b.website)) on.push("website");
    if (keys.address && norm(b.address) === keys.address) on.push("address");
    if (on.length) return { business: b, on: on.join(", ") };
  }
  return null;
}

/* ---------------- AI storefront drafting ---------------- */

export type DraftContentItem = {
  content_type: "product" | "service" | "promotion" | "update" | "event" | "irrelevant";
  title: string;
  description?: string | null;
  price?: number | null;
  category?: string | null;
  image_url?: string | null;
  availability?: string | null;
  cta?: string | null;
  source_url?: string | null;
  source_platform?: string | null;
  caption?: string | null;
};

export type DraftStoreDraft = {
  tagline: string | null;
  description: string | null;
  category: string | null;
  items: DraftContentItem[];
  note?: string;
};

const CATEGORIES = [
  "agriculture", "business-equipment", "education", "electronics", "events", "fashion", "food",
  "furniture", "health", "home", "jobs", "other", "pets", "phones", "property", "road-tennis",
  "services", "sports", "vehicles",
];

/**
 * Turns whatever public information we hold about a lead into a storefront draft.
 * Prices are only carried through when the source clearly states one — the model is
 * instructed never to invent a price, and anything unpriced shows as "Contact seller for price".
 */
export async function draftStorefrontContent(p: ProspectRow, maxItems = 8): Promise<DraftStoreDraft> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) return { tagline: null, description: null, category: null, items: [], note: "AI is not configured" };

  const facts = [
    `Business name: ${p.business_name}`,
    p.seller_type ? `Seller type: ${p.seller_type}` : "",
    p.marketplace_category ? `Category: ${p.marketplace_category}` : "",
    p.parish ? `Parish: ${p.parish}` : "",
    p.address ? `Address: ${p.address}` : "",
    p.website_url ? `Website: ${p.website_url}` : "",
    p.facebook_url ? `Facebook: ${p.facebook_url}` : "",
    p.instagram_url ? `Instagram: ${p.instagram_url}` : "",
    p.business_description ? `Known description: ${p.business_description}` : "",
    p.notes ? `Research notes: ${p.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You prepare draft marketplace storefronts for Barbados businesses using only publicly available business information. You never invent prices, phone numbers, emails or URLs. If a price is not clearly known, return null. Never misrepresent the business. Return results through the emit_store tool.",
        },
        {
          role: "user",
          content: `Draft a BajanMarket storefront for this business using its public presence.\n${facts}\n\nReturn a short tagline, a factual 2-3 sentence description, a best-fit category from this list: ${CATEGORIES.join(", ")}, and up to ${maxItems} likely products or services this business publicly offers. Classify each item. Leave price null unless a public price is genuinely known.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_store",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                tagline: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
                category: { type: ["string", "null"] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      content_type: {
                        type: "string",
                        enum: ["product", "service", "promotion", "update", "event", "irrelevant"],
                      },
                      title: { type: "string" },
                      description: { type: ["string", "null"] },
                      price: { type: ["number", "null"] },
                      category: { type: ["string", "null"] },
                      image_url: { type: ["string", "null"] },
                      availability: { type: ["string", "null"] },
                      cta: { type: ["string", "null"] },
                      source_url: { type: ["string", "null"] },
                      source_platform: { type: ["string", "null"] },
                      caption: { type: ["string", "null"] },
                    },
                    required: ["content_type", "title"],
                  },
                },
              },
              required: ["items"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_store" } },
    }),
  });

  if (res.status === 429) return { tagline: null, description: null, category: null, items: [], note: "AI is busy — try again shortly" };
  if (res.status === 402) return { tagline: null, description: null, category: null, items: [], note: "AI credits exhausted" };
  if (!res.ok) return { tagline: null, description: null, category: null, items: [], note: `AI request failed (${res.status})` };

  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argStr) return { tagline: null, description: null, category: null, items: [], note: "AI returned nothing usable" };

  let parsed: Partial<DraftStoreDraft> = {};
  try {
    parsed = JSON.parse(argStr) as Partial<DraftStoreDraft>;
  } catch {
    return { tagline: null, description: null, category: null, items: [], note: "AI returned an unreadable response" };
  }

  const clean = (v: unknown, n = 400) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s.slice(0, n) : null;
  };
  const items = (parsed.items ?? [])
    .filter((i) => typeof i?.title === "string" && i.title.trim().length > 1 && i.content_type !== "irrelevant")
    .slice(0, maxItems)
    .map((i) => ({
      content_type: i.content_type,
      title: String(i.title).trim().slice(0, 120),
      description: clean(i.description, 1200),
      price: typeof i.price === "number" && i.price > 0 ? Math.round(i.price * 100) / 100 : null,
      category: clean(i.category, 60),
      image_url: clean(i.image_url),
      availability: clean(i.availability, 80),
      cta: clean(i.cta, 120),
      source_url: clean(i.source_url),
      source_platform: clean(i.source_platform, 40),
      caption: clean(i.caption, 1200),
    })) as DraftContentItem[];

  return {
    tagline: clean(parsed.tagline, 120),
    description: clean(parsed.description, 1500),
    category: clean(parsed.category, 60),
    items,
  };
}

/* ---------------- conversion helpers ---------------- */

export const PARISH_VALUES = [
  "christ_church", "saint_andrew", "saint_george", "saint_james", "saint_john", "saint_joseph",
  "saint_lucy", "saint_michael", "saint_peter", "saint_philip", "saint_thomas",
] as const;

export function toParish(v?: string | null): Database["public"]["Enums"]["parish"] | null {
  if (!v) return null;
  const s = slugify(v).replace(/-/g, "_").replace(/^st_/, "saint_");
  const hit = PARISH_VALUES.find((p) => p === s);
  return hit ?? null;
}

export async function categoryIdFor(db: Db, label?: string | null) {
  const { data } = await db.from("categories").select("id, slug, name");
  const rows = data ?? [];
  const fallback = rows.find((r) => r.slug === "other") ?? rows[0];
  if (!label) return fallback?.id ?? null;
  const s = slugify(label);
  const exact = rows.find((r) => r.slug === s);
  if (exact) return exact.id;
  const partial = rows.find((r) => s.includes(r.slug) || r.slug.includes(s) || slugify(r.name) === s);
  return (partial ?? fallback)?.id ?? null;
}
