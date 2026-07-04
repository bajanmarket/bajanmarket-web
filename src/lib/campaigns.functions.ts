import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CAP = 500;
const FROM = "Bajan.market <marketing@bajanmarket.app>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function personalize(template: string, name: string | null) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, name?.trim() || "there");
}

function buildUnsubscribeUrl(origin: string, token: string) {
  return `${origin}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      campaign_id: z.string().uuid(),
      origin: z.string().url(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured. Connect Resend in Lovable.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent" || campaign.status === "sending") {
      throw new Error(`Campaign already ${campaign.status}`);
    }

    const { data: sends, error: sErr } = await supabaseAdmin
      .from("campaign_sends")
      .select("id, user_id, email, status")
      .eq("campaign_id", data.campaign_id)
      .eq("status", "queued")
      .limit(CAP);
    if (sErr) throw new Error(sErr.message);
    if (!sends || sends.length === 0) throw new Error("No queued recipients");

    // Fetch unsub tokens + names for personalization
    const userIds = Array.from(new Set(sends.map((s) => s.user_id).filter((v): v is string => !!v)));
    const [{ data: prefs }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("marketing_preferences").select("user_id, unsubscribe_token, email_opt_in").in("user_id", userIds),
      supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds),
    ]);
    const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    await supabaseAdmin.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of sends) {
      if (!row.user_id) { skipped++; continue; }
      const pref = prefMap.get(row.user_id);
      if (!pref || !pref.email_opt_in) {
        await supabaseAdmin.from("campaign_sends").update({ status: "skipped", error: "opted out", sent_at: new Date().toISOString() }).eq("id", row.id);
        skipped++;
        continue;
      }
      const name = nameMap.get(row.user_id) ?? null;
      const unsubUrl = pref.unsubscribe_token ? buildUnsubscribeUrl(data.origin, pref.unsubscribe_token) : null;

      const bodyText = personalize(campaign.body_text ?? "", name);
      const textFooter = unsubUrl ? `\n\n—\nUnsubscribe: ${unsubUrl}` : "";
      const htmlBody = personalize(campaign.body_html ?? escapeHtml(campaign.body_text ?? ""), name);
      const htmlFooter = unsubUrl
        ? `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="font-size:12px;color:#888"><a href="${unsubUrl}" style="color:#888">Unsubscribe</a> from Bajan.market marketing emails.</p>`
        : "";

      try {
        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: FROM,
            to: [row.email],
            subject: campaign.subject,
            text: bodyText + textFooter,
            html: htmlBody + htmlFooter,
            headers: unsubUrl
              ? { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
              : undefined,
          }),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          await supabaseAdmin.from("campaign_sends").update({
            status: "failed",
            error: json?.message ?? `HTTP ${res.status}`,
            sent_at: new Date().toISOString(),
          }).eq("id", row.id);
          failed++;
        } else {
          await supabaseAdmin.from("campaign_sends").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("id", row.id);
          sent++;
        }
      } catch (e) {
        await supabaseAdmin.from("campaign_sends").update({
          status: "failed",
          error: (e as Error).message,
          sent_at: new Date().toISOString(),
        }).eq("id", row.id);
        failed++;
      }
    }

    await supabaseAdmin.from("campaigns").update({
      status: failed > 0 && sent === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    }).eq("id", campaign.id);

    return { sent, failed, skipped };
  });
