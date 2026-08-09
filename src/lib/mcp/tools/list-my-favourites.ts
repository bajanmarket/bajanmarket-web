import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_my_favourites",
  title: "List my favourites",
  description: "List listings the signed-in user has favourited on BajanMarket.",
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
      .from("favourites")
      .select("listing_id, listings(id, title, price, currency, status, parish, cover_image_url)")
      .eq("user_id", ctx.getUserId()!);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).flatMap((f) => {
      const l = f.listings;
      return l ? [{ ...l, url: `https://bajanmarket.app/listing/${l.id}` }] : [];
    });
    return {
      content: [{ type: "text", text: `${rows.length} favourites.\n\n${JSON.stringify(rows, null, 2)}` }],
      structuredContent: { count: rows.length, favourites: rows },
    };
  },
});
