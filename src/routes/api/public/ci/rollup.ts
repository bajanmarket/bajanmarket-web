// Cron target: refreshes CI rollup tables. Called every 15 minutes by pg_cron.
// Public route bypasses auth on the published site; we validate the apikey
// header (Supabase publishable key) to avoid unauthenticated triggers.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/ci/rollup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY!;
        if (!apikey || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind") ?? "all";

        // Use service role so the SECURITY DEFINER rpcs run under a trusted key.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          if (kind === "all" || kind === "daily") {
            await supabaseAdmin.rpc("ci_refresh_rollups");
          }
          if (kind === "all" || kind === "market") {
            await supabaseAdmin.rpc("ci_refresh_category_stats");
          }
          if (kind === "all" || kind === "trust") {
            await supabaseAdmin.rpc("ci_refresh_trust_scores");
          }
        } catch (e) {
          console.error("ci rollup failed", e);
          return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
        }
        return Response.json({ ok: true, kind });
      },
    },
  },
});
