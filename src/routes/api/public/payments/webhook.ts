import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment gateway webhook receiver.
 *
 * Hard rules:
 * - Signature is verified before anything is read or written.
 * - Events are stored idempotently (unique on provider + gateway_event_id), so
 *   a replayed delivery can never duplicate a financial record.
 * - While no gateway is configured, every request is rejected with 401.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { getGatewayAdapter } = await import("@/lib/payments/gateway.server");
        const adapter = getGatewayAdapter();

        if (!adapter.isConfigured()) {
          return new Response("Payment gateway not configured", { status: 401 });
        }

        const verified = await adapter.verifyWebhook(rawBody, request.headers);
        if (!verified) return new Response("Invalid signature", { status: 401 });

        const event = await adapter.parseWebhook(rawBody);
        if (!event.id) return new Response("Unrecognized event", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("payment_webhook_events")
          .select("id, status")
          .eq("provider", adapter.name)
          .eq("gateway_event_id", event.id)
          .maybeSingle();
        if (existing) return new Response("ok (duplicate)", { status: 200 });

        const { error } = await supabaseAdmin.from("payment_webhook_events").insert({
          provider: adapter.name,
          gateway_event_id: event.id,
          event_type: event.type,
          status: "received",
          safe_payload: event.safePayload as never,
        });
        if (error) return new Response("Storage error", { status: 500 });

        // Financial reconciliation is only applied once payments are switched on.
        const { data: flag } = await supabaseAdmin
          .from("platform_feature_flags")
          .select("enabled")
          .eq("key", "marketplace_payments_enabled")
          .maybeSingle();
        if (flag?.enabled !== true) {
          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ status: "ignored", processed_at: new Date().toISOString(), failure_summary: "Payments disabled" })
            .eq("provider", adapter.name)
            .eq("gateway_event_id", event.id);
          return new Response("ok (payments disabled)", { status: 200 });
        }

        await supabaseAdmin
          .from("payment_webhook_events")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("provider", adapter.name)
          .eq("gateway_event_id", event.id);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
