import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatRelative, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({ meta: [{ title: "Inbox — Bajan.market" }] }),
  component: Inbox,
});

function Inbox() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select(`id, last_message_at, buyer_id, seller_id, buyer_hidden_at, seller_hidden_at, listing:listings(id, title, cover_image_url)`)
        .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const visible = (convs ?? []).filter((c) => {
        const hiddenAt = c.buyer_id === user!.id ? c.buyer_hidden_at : c.seller_hidden_at;
        if (!hiddenAt) return true;
        // A new message after the hide time brings the thread back
        return new Date(c.last_message_at).getTime() > new Date(hiddenAt).getTime();
      });
      const convIds = visible.map((c) => c.id);
      const ids = Array.from(new Set(visible.flatMap((c) => [c.buyer_id, c.seller_id])));
      const [{ data: profs }, unreadRes] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
          : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        convIds.length
          ? supabase
              .from("messages")
              .select("conversation_id")
              .in("conversation_id", convIds)
              .neq("sender_id", user!.id)
              .is("read_at", null)
          : Promise.resolve({ data: [] as { conversation_id: string }[] }),
      ]);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      const unreadCounts = new Map<string, number>();
      for (const m of unreadRes.data ?? []) {
        unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) ?? 0) + 1);
      }
      return visible.map((c) => ({
        ...c,
        buyer: byId.get(c.buyer_id) ?? null,
        seller: byId.get(c.seller_id) ?? null,
        unread: unreadCounts.get(c.id) ?? 0,
      }));
    },
  });

  // Realtime: refresh when new messages arrive or are marked read/delivered
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const totalUnread = (data ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-medium">Inbox</h1>
        {totalUnread > 0 && (
          <span className="text-xs font-semibold bg-coral text-white rounded-full px-2.5 py-1">
            {totalUnread} new
          </span>
        )}
      </div>
      {isLoading ? null : data && data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.map((c) => {
            const isBuyer = c.buyer_id === user?.id;
            const other = isBuyer ? c.seller : c.buyer;
            const listing = c.listing as { id: string; title: string; cover_image_url: string | null } | null;
            const unread = c.unread;
            return (
              <Link
                key={c.id}
                to="/messages/$id"
                params={{ id: c.id }}
                className={`flex items-center gap-3 bg-white rounded-2xl p-3 ring-1 transition-shadow ${
                  unread > 0 ? "ring-coral/40 hover:ring-coral/60" : "ring-hairline hover:ring-teal/30"
                }`}
              >
                <div className="size-12 rounded-xl overflow-hidden bg-sand-deep shrink-0 grid place-items-center text-xs font-semibold text-navy/50">
                  {listing?.cover_image_url
                    ? <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : initials(other?.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {other?.display_name ?? "User"}
                    </span>
                    <span className="text-[11px] text-navy/40 shrink-0">{formatRelative(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs truncate ${unread > 0 ? "text-navy font-medium" : "text-navy/60"}`}>
                      {listing?.title ?? "Listing"}
                    </div>
                    {unread > 0 && (
                      <span className="text-[10px] font-semibold bg-coral text-white rounded-full min-w-5 h-5 px-1.5 grid place-items-center shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <div className="mx-auto size-14 rounded-full bg-teal-soft grid place-items-center text-teal mb-3">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-lg font-medium">No conversations yet.</h3>
          <p className="text-sm text-navy/60 mt-2 mb-4">When you message a seller, the thread will appear here.</p>
          <Link to="/browse" className="inline-flex rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium">
            Find something to buy
          </Link>
        </div>
      )}
    </AppShell>
  );
}
