import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Marks every message in a conversation that was sent to `userId` as read.
 * Safe to call optimistically before the thread finishes loading.
 * Invalidates inbox + thread caches so unread/delivered badges refresh instantly.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string,
  qc?: QueryClient,
) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
  if (!error && qc) {
    qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    qc.invalidateQueries({ queryKey: ["conversations", userId] });
  }
}
