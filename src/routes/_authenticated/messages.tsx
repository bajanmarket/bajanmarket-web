import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatRelative, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Inbox — Bajan.market" }] }),
  component: Inbox,
});

function Inbox() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select(`id, last_message_at, buyer_id, seller_id, listing:listings(id, title, cover_image_url)`)
        .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((convs ?? []).flatMap((c) => [c.buyer_id, c.seller_id])));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
        : { data: [] };
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return (convs ?? []).map((c) => ({
        ...c,
        buyer: byId.get(c.buyer_id) ?? null,
        seller: byId.get(c.seller_id) ?? null,
      }));
    },
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-medium mb-4">Inbox</h1>
      {isLoading ? null : data && data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.map((c) => {
            const isBuyer = c.buyer_id === user?.id;
            const other = isBuyer ? c.seller : c.buyer;
            const listing = c.listing as { id: string; title: string; cover_image_url: string | null } | null;
            return (
              <Link
                key={c.id}
                to="/messages/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 bg-white rounded-2xl p-3 ring-1 ring-hairline hover:ring-teal/30 transition-shadow"
              >
                <div className="size-12 rounded-xl overflow-hidden bg-sand-deep shrink-0 grid place-items-center text-xs font-semibold text-navy/50">
                  {listing?.cover_image_url
                    ? <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : initials(other?.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{other?.display_name ?? "User"}</span>
                    <span className="text-[11px] text-navy/40 shrink-0">{formatRelative(c.last_message_at)}</span>
                  </div>
                  <div className="text-xs text-navy/60 truncate">{listing?.title ?? "Listing"}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <h3 className="text-lg font-medium">No conversations yet.</h3>
          <p className="text-sm text-navy/60 mt-2">When you message a seller, the thread will appear here.</p>
        </div>
      )}
    </AppShell>
  );
}
