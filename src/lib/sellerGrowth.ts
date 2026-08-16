/** Shared, client-safe constants and helpers for the Seller Growth Agent module. */

export type PipelineStage =
  | "discovered"
  | "verification_required"
  | "qualified"
  | "ready_for_outreach"
  | "awaiting_approval"
  | "contacted"
  | "replied"
  | "demo_scheduled"
  | "onboarding"
  | "trial_active"
  | "activated_seller"
  | "declined"
  | "suppressed";

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "discovered", label: "Discovered" },
  { key: "verification_required", label: "Verification Required" },
  { key: "qualified", label: "Qualified" },
  { key: "ready_for_outreach", label: "Ready for Outreach" },
  { key: "awaiting_approval", label: "Awaiting Approval" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "demo_scheduled", label: "Demonstration Scheduled" },
  { key: "onboarding", label: "Onboarding" },
  { key: "trial_active", label: "Trial Active" },
  { key: "activated_seller", label: "Activated Seller" },
  { key: "declined", label: "Declined" },
  { key: "suppressed", label: "Suppressed – Do Not Contact" },
];

export const stageLabel = (s: string) =>
  PIPELINE_STAGES.find((x) => x.key === s)?.label ?? s;

export type RecordMode = "demo" | "simulation" | "live";
export type OutreachChannel =
  | "email"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "phone"
  | "in_person"
  | "other";

export const OUTREACH_CHANNELS: OutreachChannel[] = [
  "email",
  "whatsapp",
  "facebook",
  "instagram",
  "phone",
  "in_person",
  "other",
];

export const SELLER_TYPES = [
  { key: "vehicle_dealer", label: "Vehicle dealer" },
  { key: "real_estate_agent", label: "Real-estate agent" },
  { key: "furniture_appliance", label: "Furniture & appliance store" },
  { key: "electronics_phones", label: "Electronics & phone seller" },
  { key: "fashion_boutique", label: "Fashion boutique" },
  { key: "beauty_products", label: "Beauty-product seller" },
  { key: "restaurant", label: "Restaurant / food business" },
  { key: "home_service", label: "Home-service provider" },
  { key: "mechanic_autoparts", label: "Mechanic / auto parts" },
  { key: "event_vendor", label: "Event vendor" },
  { key: "pet_service", label: "Pet-service provider" },
  { key: "equipment_tools", label: "Equipment & tool supplier" },
  { key: "facebook_power_seller", label: "Facebook Marketplace power seller" },
  { key: "instagram_business", label: "Instagram business" },
  { key: "retailer", label: "Established retailer" },
  { key: "service_provider", label: "Service provider" },
  { key: "general", label: "Other legitimate seller" },
];

export const sellerTypeLabel = (k?: string | null) =>
  SELLER_TYPES.find((t) => t.key === k)?.label ?? (k ?? "—");

/** Categories that may never be prospected or onboarded. */
export const PROHIBITED_CATEGORY_TERMS = [
  "weapon",
  "firearm",
  "ammunition",
  "gun",
  "drug",
  "narcotic",
  "cannabis",
  "tobacco",
  "vape",
  "alcohol",
  "adult",
  "escort",
  "pornograph",
  "gambling",
  "casino",
  "counterfeit",
  "replica designer",
  "prescription",
  "steroid",
  "wildlife",
  "ivory",
  "human hair harvest",
  "loan shark",
  "crypto investment",
];

export function prohibitedMatches(...values: (string | null | undefined)[]) {
  const hay = values.filter(Boolean).join(" ").toLowerCase();
  return PROHIBITED_CATEGORY_TERMS.filter((t) => hay.includes(t));
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Barbados is AST (UTC-4) year round. */
export const BARBADOS_TZ = "America/Barbados";

export function barbadosNowParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BARBADOS_TZ,
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  return { hour, weekday };
}

export function formatBarbados(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BARBADOS_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso)) + " AST";
}

export function normalizeKeyValue(v: string | null | undefined) {
  if (!v) return "";
  return v.toLowerCase().replace(/[^a-z0-9@.]/g, "");
}

export function normalizeName(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function domainOf(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

/** Renders a template with only verified prospect values; unknown tokens stay blank-safe. */
export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v && String(v).trim()) return String(v).trim();
    if (key === "contact_name") return "there";
    return "";
  });
}
