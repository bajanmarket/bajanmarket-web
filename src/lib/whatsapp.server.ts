/**
 * Official WhatsApp Business Platform (Meta Cloud API) sender.
 * Server-only. Never import from browser code.
 *
 * Required secrets (feature stays inert until they exist):
 *   WHATSAPP_PHONE_NUMBER_ID  – the Cloud API phone number ID
 *   WHATSAPP_ACCESS_TOKEN     – permanent system-user access token
 *   WHATSAPP_TEMPLATE_NAME    – optional approved template name
 *   WHATSAPP_TEMPLATE_LANG    – optional template language (default en)
 */

export type WhatsAppResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/** Normalises to digits only (E.164 without the leading +), as the Cloud API expects. */
export function normalisePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Barbados: local 7-digit and 246XXXXXXX both become 1246XXXXXXX.
  if (digits.length === 7) digits = `1246${digits}`;
  else if (digits.length === 10 && digits.startsWith("246")) digits = `1${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export async function sendWhatsApp(to: string, body: string): Promise<WhatsAppResult> {
  if (!whatsappConfigured()) return { status: "skipped", reason: "WhatsApp channel not configured" };

  const phone = normalisePhone(to);
  if (!phone) return { status: "failed", error: "Invalid phone number" };

  const id = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG ?? "en";

  const payload = templateName
    ? {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [{ type: "body", parameters: [{ type: "text", text: body }] }],
        },
      }
    : {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { preview_url: true, body },
      };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      console.error("WhatsApp send failed", res.status, msg);
      return { status: "failed", error: msg };
    }
    return { status: "sent", providerMessageId: json?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}
