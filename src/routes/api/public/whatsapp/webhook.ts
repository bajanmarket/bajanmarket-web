import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * Outbound-only release: this endpoint records delivery statuses for messages
 * BajanMarket already sent. It never creates or changes bookings, never
 * touches consent, and never ingests inbound conversations — all messaging
 * stays inside BajanMarket.
 */

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

function verifySignature(raw: string, header: string | null, secret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // Meta verification handshake.
      GET: async ({ request }) => {
        const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (!verifyToken) return new Response("Not configured", { status: 503 });
        if (mode === "subscribe" && token && token.length === verifyToken.length &&
            timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken))) {
          return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const secret = process.env.WHATSAPP_APP_SECRET;
        const raw = await request.text();
        if (!secret) return new Response("Not configured", { status: 503 });
        if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
          console.warn("whatsapp webhook: invalid signature rejected");
          return new Response("Invalid signature", { status: 401 });
        }

        // Always 200 after this point: Meta retries aggressively on errors and
        // the payload is already durable on their side.
        try {
          const body = JSON.parse(raw) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const statuses: any[] = [];
          for (const entry of body?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
              for (const s of change?.value?.statuses ?? []) statuses.push(s);
              // Inbound messages are intentionally ignored in this release.
            }
          }

          for (const s of statuses) {
            const providerId: string | undefined = s?.id;
            const status: string | undefined = s?.status;
            if (!providerId || !status || !(status in RANK)) continue;

            const eventKey = `${providerId}:${status}:${s?.timestamp ?? ""}`.slice(0, 300);
            // Idempotency: a replayed webhook is recorded once and then ignored.
            const { error: dupErr } = await supabaseAdmin
              .from("whatsapp_webhook_events")
              .insert({ event_key: eventKey, kind: "status" });
            if (dupErr) continue;

            const { data: row } = await supabaseAdmin
              .from("notification_deliveries")
              .select("id, status_rank")
              .eq("provider_message_id", providerId)
              .maybeSingle();
            // Unknown provider message ids are ignored safely — and the response
            // is identical, so nothing is revealed about who exists.
            if (!row) continue;

            const rank = RANK[status];
            // Monotonic: read can never be downgraded back to sent/delivered.
            if ((row.status_rank ?? 0) >= rank && status !== "failed") continue;

            const err = s?.errors?.[0];
            await supabaseAdmin
              .from("notification_deliveries")
              .update({
                provider_status: status,
                status_rank: Math.max(row.status_rank ?? 0, rank),
                status_at: new Date().toISOString(),
                status: status === "failed" ? "failed" : "sent",
                provider_error_code: err?.code ? String(err.code) : null,
                error: err ? String(err.title ?? err.message ?? "Delivery failed").slice(0, 300) : null,
              })
              .eq("id", row.id);
          }
        } catch (e) {
          // Malformed payloads must not crash the endpoint.
          console.warn("whatsapp webhook: unprocessable payload", (e as Error).message);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
