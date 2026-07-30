/**
 * Official WhatsApp Business Platform (Meta Cloud API) sender.
 * Server-only. Never import from browser code.
 *
 * Required secrets (feature stays inert until they all exist):
 *   WHATSAPP_PHONE_NUMBER_ID     – Cloud API phone number ID
 *   WHATSAPP_ACCESS_TOKEN        – permanent system-user access token
 *   WHATSAPP_BUSINESS_ACCOUNT_ID – WABA the phone number must belong to
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN– token Meta echoes on GET verification
 *   WHATSAPP_APP_SECRET          – used to verify webhook signatures
 *
 * Per-event approved template names (optional until that event is used):
 *   WHATSAPP_TEMPLATE_BOOKING_RECEIVED / _CONFIRMED / _DECLINED /
 *   WHATSAPP_TEMPLATE_RESCHEDULE / _REMINDER / _NEW_MESSAGE /
 *   WHATSAPP_TEMPLATE_BOOKING_CANCELLED
 *   WHATSAPP_TEMPLATE_LANG (default "en")
 *
 * Production sending is additionally gated by the owner-controlled
 * whatsapp_settings row — credentials alone never enable live sending.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type WhatsAppEvent =
  | "booking_submitted"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_reschedule_requested"
  | "booking_cancelled"
  | "booking_reminder"
  | "message";

/** Maps each notification event to the secret holding its approved template name. */
export const TEMPLATE_ENV: Record<WhatsAppEvent, string> = {
  booking_submitted: "WHATSAPP_TEMPLATE_BOOKING_RECEIVED",
  booking_confirmed: "WHATSAPP_TEMPLATE_BOOKING_CONFIRMED",
  booking_declined: "WHATSAPP_TEMPLATE_BOOKING_DECLINED",
  booking_reschedule_requested: "WHATSAPP_TEMPLATE_RESCHEDULE",
  booking_cancelled: "WHATSAPP_TEMPLATE_BOOKING_CANCELLED",
  booking_reminder: "WHATSAPP_TEMPLATE_REMINDER",
  message: "WHATSAPP_TEMPLATE_NEW_MESSAGE",
};

export const REQUIRED_SECRETS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
] as const;

export type WhatsAppResult =
  | { status: "sent"; providerMessageId: string | null; isTest: boolean }
  | { status: "suppressed"; reason: string }
  | { status: "failed"; error: string; errorCode?: string | null };

export function missingSecrets() {
  return REQUIRED_SECRETS.filter((k) => !process.env[k]);
}

export function whatsappConfigured() {
  return missingSecrets().length === 0;
}

/** Digits only (E.164 without the leading +), as the Cloud API expects. */
export function normalisePhone(raw: string) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  // Barbados: local 7-digit and 246XXXXXXX both become 1246XXXXXXX.
  if (digits.length === 7) digits = `1246${digits}`;
  else if (digits.length === 10 && digits.startsWith("246")) digits = `1${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Never log a full number. */
export function maskPhone(phone: string) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length <= 4 ? "***" : `***${d.slice(-4)}`;
}

/** Only these safe fields may ever become template parameters. */
export type TemplateParams = {
  reference: string;
  serviceName?: string;
  date?: string;
  time?: string;
  tzLabel?: string;
  link: string;
};

export function buildTemplateParameters(p: TemplateParams) {
  const clean = (s: string | undefined) =>
    (s ?? "").replace(/[\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);
  return [
    clean(p.reference) || "—",
    clean(p.serviceName) || "your booking",
    clean(p.date) || "—",
    `${clean(p.time) || "—"}${p.tzLabel ? ` ${clean(p.tzLabel)}` : ""}`,
    clean(p.link),
  ].map((text) => ({ type: "text" as const, text }));
}

type Sendability =
  | { ok: true; mode: "production" | "test" }
  | { ok: false; reason: string };

/**
 * Server-side readiness gate. Credentials existing is never sufficient:
 * production must be explicitly activated by the owner, and while test mode
 * is on only allowlisted numbers can be reached.
 */
export async function checkSendable(phoneDigits: string, event: WhatsAppEvent): Promise<Sendability> {
  const missing = missingSecrets();
  if (missing.length) return { ok: false, reason: `Missing credentials: ${missing.join(", ")}` };
  if (!process.env[TEMPLATE_ENV[event]]) return { ok: false, reason: `No approved template configured for ${event}` };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("production_enabled, test_mode")
    .eq("id", 1)
    .maybeSingle();

  if (settings?.production_enabled) return { ok: true, mode: "production" };

  if (settings?.test_mode) {
    const { data: allow } = await supabaseAdmin
      .from("whatsapp_test_numbers")
      .select("phone")
      .eq("phone", phoneDigits)
      .maybeSingle();
    if (!allow) return { ok: false, reason: "Test mode: recipient is not an approved test number" };
    return { ok: true, mode: "test" };
  }

  return { ok: false, reason: "WhatsApp production sending is disabled" };
}

async function postMessage(payload: Record<string, unknown>) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const res = await fetch(`${GRAPH}/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/**
 * Sends one approved transactional template. Outbound only — this release does
 * not support two-way WhatsApp conversations.
 */
export async function sendWhatsAppTemplate(
  rawPhone: string,
  event: WhatsAppEvent,
  params: TemplateParams,
): Promise<WhatsAppResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { status: "failed", error: "Invalid phone number" };

  const gate = await checkSendable(phone, event);
  if (!gate.ok) return { status: "suppressed", reason: gate.reason };

  const name = process.env[TEMPLATE_ENV[event]]!;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "en";
  const parameters = buildTemplateParameters(params);
  if (gate.mode === "test") parameters[0] = { type: "text", text: `TEST ${parameters[0].text}` };

  try {
    const r = await postMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: { name, language: { code: lang }, components: [{ type: "body", parameters }] },
    });
    if (!r.ok) {
      const msg = r.json?.error?.message ?? `HTTP ${r.status}`;
      console.error("WhatsApp send failed", { to: maskPhone(phone), event, status: r.status, code: r.json?.error?.code });
      return { status: "failed", error: String(msg).slice(0, 300), errorCode: r.json?.error?.code ? String(r.json.error.code) : null };
    }
    return { status: "sent", providerMessageId: r.json?.messages?.[0]?.id ?? null, isTest: gate.mode === "test" };
  } catch (e) {
    return { status: "failed", error: (e as Error).message.slice(0, 300) };
  }
}

/**
 * Owner connection test — never touches marketplace users. Validates the token,
 * that the phone number belongs to the configured WABA, and lists templates.
 */
export async function testMetaConnection() {
  const missing = missingSecrets();
  if (missing.length) return { ok: false, detail: `Missing credentials: ${missing.join(", ")}`, templates: [] as { name: string; status: string; language: string }[] };

  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const numbersRes = await fetch(`${GRAPH}/${waba}/phone_numbers?limit=50`, { headers: auth });
    const numbers: any = await numbersRes.json().catch(() => ({}));
    if (!numbersRes.ok) {
      return { ok: false, detail: `Meta rejected the credentials: ${numbers?.error?.message ?? numbersRes.status}`, templates: [] };
    }
    const belongs = (numbers?.data ?? []).some((n: any) => String(n.id) === String(phoneId));
    if (!belongs) {
      return { ok: false, detail: "The Phone Number ID does not belong to the configured WhatsApp Business Account", templates: [] };
    }

    const tplRes = await fetch(`${GRAPH}/${waba}/message_templates?limit=100&fields=name,status,language`, { headers: auth });
    const tpl: any = await tplRes.json().catch(() => ({}));
    const templates = (tpl?.data ?? []).map((t: any) => ({ name: t.name, status: t.status, language: t.language }));
    return { ok: true, detail: "Meta connection verified", templates };
  } catch (e) {
    return { ok: false, detail: (e as Error).message.slice(0, 300), templates: [] };
  }
}
