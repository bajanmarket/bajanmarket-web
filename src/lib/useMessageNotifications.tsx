import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

/**
 * While the app is open (any tab), alert on new incoming messages:
 * - In-app toast (always)
 * - System notification via the Notification API (when permission granted
 *   and the tab isn't currently focused on the matching thread)
 * Clicking the system notification focuses the tab and opens the thread.
 */
export function useMessageNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  const openThread = (conversationId: string) => {
    if (typeof window !== "undefined") window.focus();
    // Prime caches so the thread + inbox render fresh state immediately
    qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    if (user) qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    router.navigate({
      to: "/messages/$id",
      params: { id: conversationId },
    });
  };



  // Ask for permission once, on the first mount after sign-in
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      const id = window.setTimeout(() => {
        void Notification.requestPermission();
      }, 4000);
      return () => window.clearTimeout(id);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const ch = supabase
      .channel(`notify-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
          };
          if (m.sender_id === user.id) return;
          if (seen.current.has(m.id)) return;
          seen.current.add(m.id);

          // Only surface if this conversation actually involves me
          const { data: conv } = await supabase
            .from("conversations")
            .select("id, buyer_id, seller_id, listing:listings(title)")
            .eq("id", m.conversation_id)
            .maybeSingle();
          if (!conv) return;
          if (conv.buyer_id !== user.id && conv.seller_id !== user.id) return;

          const { data: sender } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", m.sender_id)
            .maybeSingle();

          const senderName = sender?.display_name ?? "New message";
          const listingTitle =
            (conv.listing as { title?: string } | null)?.title ?? "your listing";
          const threadPath = `/messages/${m.conversation_id}`;
          const alreadyViewing =
            typeof window !== "undefined" &&
            window.location.pathname === threadPath &&
            document.visibilityState === "visible";
          if (alreadyViewing) return;

          // In-app toast (fires even when tab is focused elsewhere in the app)
          toast(`${senderName} · ${listingTitle}`, {
            description: m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body,
            action: {
              label: "Open",
              onClick: () => openThread(m.conversation_id),
            },
          });

          // System notification when the tab isn't focused
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            try {
              const n = new Notification(`${senderName} — ${listingTitle}`, {
                body: m.body,
                tag: `bm-msg-${m.conversation_id}`,
                icon: "/favicon.ico",
              });
              n.onclick = () => {
                openThread(m.conversation_id);
                n.close();
              };
            } catch {
              // Notification constructor can throw in some contexts; toast still fires
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, router, qc]);
}

