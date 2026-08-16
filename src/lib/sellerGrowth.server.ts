import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  domainOf,
  normalizeKeyValue,
  normalizeName,
  prohibitedMatches,
  renderTemplate,
  barbadosNowParts,
} from "@/lib/sellerGrowth";

export type Db = SupabaseClient<Database>;
export type ProspectRow = Database["public"]["Tables"]["seller_prospects"]["Row"];

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

export async function audit(
  db: Db,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: Record<string, unknown> = {},
) {
  await db.from("seller_growth_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail: detail as never,
  });
}

export async function getSettings(db: Db) {
  const { data, error } = await db
    .from("seller_growth_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Seller Growth settings missing");
  return data;
}

/** Duplicate detection across normalized identity signals. Never merges automatically. */
export async function findDuplicates(db: Db, p: Partial<ProspectRow>, excludeId?: string) {
  const { data } = await db
    .from("seller_prospects")
    .select("id, business_name, public_phone, public_email, website_url, facebook_url, instagram_url")
    .limit(2000);
  const rows = (data ?? []).filter((r) => r.id !== excludeId);
  const matches: { id: string; business_name: string; on: string }[] = [];
  const name = p.business_name ? normalizeName(p.business_name) : "";
  const phone = normalizeKeyValue(p.public_phone);
  const email = normalizeKeyValue(p.public_email);
  const dom = domainOf(p.website_url);
  const fb = normalizeKeyValue(p.facebook_url);
  const ig = normalizeKeyValue(p.instagram_url);
  for (const r of rows) {
    const on: string[] = [];
    if (name && normalizeName(r.business_name) === name) on.push("business name");
    if (phone && normalizeKeyValue(r.public_phone) === phone) on.push("phone");
    if (email && normalizeKeyValue(r.public_email) === email) on.push("email");
    if (dom && domainOf(r.website_url) === dom) on.push("website domain");
    if (fb && normalizeKeyValue(r.facebook_url) === fb) on.push("facebook page");
    if (ig && normalizeKeyValue(r.instagram_url) === ig) on.push("instagram");
    if (on.length) matches.push({ id: r.id, business_name: r.business_name, on: on.join(", ") });
  }
  return matches;
}

export async function isSuppressed(db: Db, p: Partial<ProspectRow>) {
  const values = [p.public_phone, p.public_email, p.website_url, p.facebook_url, p.instagram_url, p.business_name]
    .filter(Boolean)
    .map((v) => normalizeKeyValue(v as string));
  if (!values.length) return null;
  const { data } = await db.from("seller_suppressions").select("*").limit(2000);
  return (data ?? []).find((s) => values.includes(s.match_value_norm ?? "")) ?? null;
}

export type Verification = {
  passed: boolean;
  checks: { key: string; label: string; status: "pass" | "fail" | "unknown"; note?: string }[];
  duplicates: { id: string; business_name: string; on: string }[];
};

export async function verifyProspect(db: Db, prospect: ProspectRow): Promise<Verification> {
  const checks: Verification["checks"] = [];
  const add = (key: string, label: string, status: "pass" | "fail" | "unknown", note?: string) =>
    checks.push(note ? { key, label, status, note } : { key, label, status });

  add(
    "barbados",
    "Operates in Barbados",
    prospect.parish ? "pass" : "unknown",
    prospect.parish ? undefined : "No parish/location recorded",
  );
  add(
    "active",
    "Appears active",
    prospect.posting_frequency ? "pass" : "unknown",
    prospect.posting_frequency ? undefined : "Posting frequency unknown",
  );

  const banned = prohibitedMatches(prospect.marketplace_category, prospect.seller_type, prospect.notes);
  add(
    "allowed",
    "Products/services are allowed",
    banned.length ? "fail" : "pass",
    banned.length ? `Restricted terms: ${banned.join(", ")}` : undefined,
  );

  const hasContact = Boolean(prospect.public_phone || prospect.public_email || prospect.public_whatsapp);
  add("contact", "Public business contact listed", hasContact ? "pass" : "unknown");

  add(
    "not_seller",
    "Not already a BajanMarket seller",
    prospect.bajanmarket_account_status === "existing_seller" ? "fail" : prospect.bajanmarket_account_status === "unknown" ? "unknown" : "pass",
  );

  const duplicates = await findDuplicates(db, prospect, prospect.id);
  add("duplicate", "Not already in the prospect database", duplicates.length ? "fail" : "pass");

  add("opt_out", "Has not opted out", prospect.opted_out ? "fail" : "pass");

  const supp = await isSuppressed(db, prospect);
  add("suppressed", "Not on the suppression list", supp ? "fail" : "pass", supp?.reason);

  add(
    "fraud",
    "No fraud/suspicion flags",
    prospect.verification_status === "rejected" ? "fail" : "pass",
  );

  return { passed: checks.every((c) => c.status === "pass"), checks, duplicates };
}

/** Lead score from the editable rules table. Unknown evidence scores zero and is reported. */
export async function computeScore(db: Db, prospect: ProspectRow) {
  const { data: rules } = await db
    .from("seller_scoring_rules")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  const active = rules ?? [];
  const evidence: Record<string, number | null> = {
    listing_volume: ratio(prospect.estimated_potential_listings ?? prospect.visible_product_count, 50),
    posting_frequency: freqScore(prospect.posting_frequency),
    group_activity: freqScore(prospect.facebook_group_activity),
    audience_engagement: ratio(prospect.audience_estimate, 5000),
    photo_quality: null,
    verification_strength:
      prospect.verification_status === "verified" ? 1 : prospect.verification_status === "needs_review" ? 0.5 : null,
    delivery_available: prospect.delivery_available === null ? null : prospect.delivery_available ? 1 : 0,
    no_ecommerce: prospect.has_existing_website === null ? null : prospect.has_existing_website ? 0 : 1,
    category_fit: prospect.marketplace_category ? 0.7 : null,
    info_completeness: completeness(prospect),
  };

  const breakdown: Record<string, { points: number; max: number; basis: string }> = {};
  const missing: string[] = [];
  let total = 0;
  let maxTotal = 0;
  for (const r of active) {
    maxTotal += r.max_points;
    const e = evidence[r.key];
    if (e === null || e === undefined) {
      missing.push(r.label);
      breakdown[r.key] = { points: 0, max: r.max_points, basis: "unknown — no evidence recorded" };
      continue;
    }
    const points = Math.round(Math.max(0, Math.min(1, e)) * r.max_points);
    total += points;
    breakdown[r.key] = { points, max: r.max_points, basis: `${Math.round(e * 100)}% of rule target` };
  }
  const score = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
  const priority = score >= 75 ? "urgent" : score >= 55 ? "high" : score >= 35 ? "medium" : "low";
  const channel = prospect.preferred_channel
    ?? (prospect.public_whatsapp ? "whatsapp" : prospect.public_email ? "email" : prospect.facebook_url ? "facebook" : prospect.instagram_url ? "instagram" : "other");
  const explanation = `Scored ${score}/100 across ${active.length} active rules. ${missing.length} rule(s) had no evidence and scored zero.`;
  return { score, breakdown, missing, priority, channel, explanation } as const;
}

function ratio(v: number | null | undefined, target: number) {
  if (v === null || v === undefined) return null;
  return Math.min(1, v / target);
}
function freqScore(v: string | null | undefined) {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes("daily")) return 1;
  if (s.includes("week")) return 0.7;
  if (s.includes("month")) return 0.4;
  if (s.includes("rare") || s.includes("inactive")) return 0.1;
  return 0.5;
}
function completeness(p: ProspectRow) {
  const fields = [p.contact_name, p.parish, p.website_url, p.facebook_url, p.instagram_url, p.public_phone, p.public_email];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

export type SendGuardResult = { allowed: boolean; simulated: boolean; reasons: string[] };

/** Enforces simulation mode, pauses, limits, business hours and suppression before any send. */
export async function evaluateSendGuards(
  db: Db,
  prospect: ProspectRow,
  channel: string,
): Promise<SendGuardResult> {
  const s = await getSettings(db);
  const reasons: string[] = [];
  if (prospect.opted_out) reasons.push("Prospect has opted out");
  if (prospect.pipeline_stage === "suppressed") reasons.push("Prospect is suppressed – do not contact");
  if (await isSuppressed(db, prospect)) reasons.push("Prospect matches the suppression list");
  if (s.global_outreach_paused) reasons.push("Global outreach pause is on");
  if (channel === "email" && s.email_paused) reasons.push("Email channel is paused");
  if (channel === "whatsapp" && s.whatsapp_paused) reasons.push("WhatsApp channel is paused");
  if ((channel === "facebook" || channel === "instagram") && s.social_paused) reasons.push("Social channels are paused");

  const { hour, weekday } = barbadosNowParts();
  if (hour < s.business_hours_start || hour >= s.business_hours_end)
    reasons.push(`Outside Barbados business hours (${s.business_hours_start}:00–${s.business_hours_end}:00 AST)`);
  if (weekday === "Sun") reasons.push("Sunday — outside outreach days (AST)");

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count: dayCount } = await db
    .from("seller_outreach_messages")
    .select("id", { count: "exact", head: true })
    .eq("simulated", false)
    .gte("created_at", since);
  if ((dayCount ?? 0) >= s.daily_contact_limit) reasons.push("Daily contact limit reached");

  const weekSince = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: weekCount } = await db
    .from("seller_outreach_messages")
    .select("id", { count: "exact", head: true })
    .eq("simulated", false)
    .gte("created_at", weekSince);
  if ((weekCount ?? 0) >= s.weekly_contact_limit) reasons.push("Weekly contact limit reached");

  const { count: attempts } = await db
    .from("seller_outreach_messages")
    .select("id", { count: "exact", head: true })
    .eq("prospect_id", prospect.id);
  if ((attempts ?? 0) >= s.max_contact_attempts) reasons.push("Maximum contact attempts reached");

  const simulated = s.simulation_mode || !s.live_sending_enabled;
  const blocking = reasons.filter(
    (r) => r.includes("opted out") || r.includes("suppress") || r.includes("limit") || r.includes("attempts"),
  );
  return { allowed: simulated ? blocking.length === 0 : reasons.length === 0, simulated, reasons };
}

export function buildDraftBody(
  playbook: Database["public"]["Tables"]["seller_outreach_playbooks"]["Row"],
  prospect: ProspectRow,
  step: "initial" | "followup_1" | "followup_final",
) {
  const template =
    step === "initial"
      ? playbook.initial_template
      : step === "followup_1"
        ? playbook.followup_1_template
        : playbook.followup_final_template;
  const body = renderTemplate(template, {
    business_name: prospect.business_name,
    contact_name: prospect.contact_name,
    parish: prospect.parish,
    seller_type: prospect.seller_type,
  });
  const warnings: string[] = [];
  const banned = prohibitedMatches(prospect.marketplace_category, prospect.seller_type, prospect.notes);
  if (banned.length) warnings.push(`Restricted category terms detected: ${banned.join(", ")}`);
  if (!prospect.contact_name) warnings.push("No verified contact name — message uses a generic greeting");
  if (!prospect.public_email && !prospect.public_whatsapp && !prospect.public_phone)
    warnings.push("No verified public business contact recorded");
  if (prospect.verification_status !== "verified") warnings.push("Prospect is not verified yet");
  return { body, warnings };
}
