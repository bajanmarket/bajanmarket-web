// Public campaign tracking redirect.
// GET /api/public/ci/c/:code → logs a CampaignVisited event, then 302s
// to the campaign's destination_path with the campaign code preserved in UTM.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/ci/c/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const code = String(params.code || "").slice(0, 64);
        if (!code) return new Response("Bad request", { status: 400 });

        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(process.env.SUPABASE_URL!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: campaign } = await supabase
          .from("attribution_campaigns")
          .select("channel, destination_path, archived_at")
          .eq("code", code)
          .maybeSingle();

        if (!campaign || campaign.archived_at) {
          return new Response("Campaign not found", { status: 404 });
        }

        // Fire-and-forget the visit event via the SECURITY DEFINER RPC.
        void supabase.rpc("ci_log_event", {
          _event_type: "CampaignVisited",
          _campaign_code: code,
          _source: campaign.channel,
          _medium: "campaign",
          _referrer: request.headers.get("referer") || undefined,
          _path: campaign.destination_path,
        });

        // Only allow same-site destinations (path must start with /).
        const dest = campaign.destination_path.startsWith("/") ? campaign.destination_path : "/";
        const sep = dest.includes("?") ? "&" : "?";
        const target = `${dest}${sep}utm_source=${encodeURIComponent(campaign.channel)}&utm_medium=campaign&utm_campaign=${encodeURIComponent(code)}`;
        throw redirect({ href: target, statusCode: 302 });
      },
    },
  },
});
