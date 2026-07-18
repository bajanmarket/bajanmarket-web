import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_my_conversations",
  title: "List my conversations",
  description: "List the signed-in user's message threads on Bajan.market with the other participant and listing.",
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
    const uid = ctx.getUserId()!;
    const { data, error } = await sb
      .from("conversations")
      .select("id, listing_id, buyer_id, seller_id, last_message_at, listings(title)")
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((c) => ({
      id: c.id,
      listing_title: c.listings?.title,
      role: c.buyer_id === uid ? "buyer" : "seller",
      last_message_at: c.last_message_at,
      url: `https://bajanmarket.app/messages/${c.id}`,
    }));
    return {
      content: [{ type: "text", text: `${rows.length} conversations.\n\n${JSON.stringify(rows, null, 2)}` }],
      structuredContent: { count: rows.length, conversations: rows },
    };
  },
});
