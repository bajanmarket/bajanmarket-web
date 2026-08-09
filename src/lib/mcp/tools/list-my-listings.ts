import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_my_listings",
  title: "List my listings",
  description: "List the signed-in user's own listings on BajanMarket, including drafts and sold items.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data, error } = await sb
      .from("listings")
      .select("id, title, price, currency, status, views, favourite_count, created_at")
      .eq("seller_id", ctx.getUserId()!)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((l) => ({ ...l, url: `https://bajanmarket.app/listing/${l.id}` }));
    return {
      content: [{ type: "text", text: `You have ${rows.length} listings.\n\n${JSON.stringify(rows, null, 2)}` }],
      structuredContent: { count: rows.length, listings: rows },
    };
  },
});
