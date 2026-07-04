import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

/**
 * Global delivery watcher: while the user's app is open, mark any incoming
 * message (from other participants) as delivered. This is the "reached the
 * recipient's device" signal — independent from read_at (opening the thread).
 */
export function useDeliveryReceipts() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const markDelivered = async (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      await supabase
        .from("messages")
        .update({ delivered_at: new Date().toISOString() })
        .in("id", messageIds)
        .is("delivered_at", null)
        .neq("sender_id", user.id);
    };

    // Backfill: any undelivered messages sent to me while offline
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .is("delivered_at", null)
        .neq("sender_id", user.id)
        .limit(200);
      if (data?.length) await markDelivered(data.map((m) => m.id));
    })();

    // Live: mark new inserts delivered on arrival
    const ch = supabase
      .channel(`delivery-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as { id: string; sender_id: string };
          if (m.sender_id !== user.id) void markDelivered([m.id]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);
}
