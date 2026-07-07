import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, CheckCircle2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";
import { ShareMenu } from "@/components/ShareMenu";
import { sharePrefill } from "@/lib/share";
import { SITE_URL } from "@/lib/share";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [{ title: "My listings — Bajan.market" }] }),
  component: MyListings,
});

function MyListings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, currency, status, cover_image_url, views, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateFeeds = () => {
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("listings").update({ status: status as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "sold" ? "Marked as sold" : "Updated");
    invalidateFeeds();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("listings").delete().eq("id", pendingDelete.id);
    setPendingDelete(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    invalidateFeeds();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-medium">My listings</h1>
        <Link to="/post" className="rounded-full bg-coral text-white px-4 py-2 text-sm font-medium">+ New</Link>
      </div>
      <div className="flex flex-col gap-2">
        {data?.map((l) => (
          <div key={l.id} className="bg-white rounded-2xl ring-1 ring-hairline p-3 flex items-center gap-3">
            <Link to="/listing/$id" params={{ id: l.id }} className="size-16 rounded-xl overflow-hidden bg-sand-deep shrink-0">
              {l.cover_image_url && <img src={l.cover_image_url} alt="" className="w-full h-full object-cover" />}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium truncate">{l.title}</div>
                <StatusBadge status={l.status} />
              </div>
              <div className="text-xs text-navy/60">{formatBBD(l.price, l.currency)} · {l.views} views</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={l.status}
                onChange={(e) => setStatus(l.id, e.target.value)}
                className="text-[11px] bg-sand rounded-full px-2 py-1 outline-none"
                aria-label="Change listing status"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="sold">Sold</option>
              </select>
              <ShareMenu
                url={`${SITE_URL}/listing/${l.id}`}
                title={l.title}
                text={sharePrefill("my_listings", { title: l.title, price: formatBBD(l.price, l.currency) })}
                source="my_listings"
                trigger={
                  <button className="p-1.5 rounded-full text-navy/60 hover:bg-sand" aria-label="Share listing" title="Share">
                    <Share2 className="size-4" />
                  </button>
                }
              />
              {l.status !== "sold" && (
                <button
                  onClick={() => setStatus(l.id, "sold")}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:text-teal/80"
                  title="Mark as sold"
                >
                  <CheckCircle2 className="size-3.5" /> Sold
                </button>
              )}
              <button
                onClick={() => setPendingDelete({ id: l.id, title: l.title })}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:opacity-80"
                title="Delete listing"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
            <h3 className="text-lg font-medium">Nothing listed yet.</h3>
            <p className="text-sm text-navy/60 mt-2 mb-4">Post your first item and it'll show here.</p>
            <Link to="/post" className="inline-flex rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium">Post a listing</Link>
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be permanently removed. This can't be undone.
              If you've sold it, mark it as Sold instead to keep the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-teal-soft text-teal",
    paused: "bg-sand-deep text-navy/60",
    sold: "bg-navy text-white",
  };
  return <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${map[status] ?? ""}`}>{status}</span>;
}
