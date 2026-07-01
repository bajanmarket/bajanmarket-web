import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [{ title: "My listings — Bajan.market" }] }),
  component: MyListings,
});

function MyListings() {
  const { user } = useAuth();
  const qc = useQueryClient();
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

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("listings").update({ status: status as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
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
            <div className="flex flex-col gap-1">
              <select
                value={l.status}
                onChange={(e) => setStatus(l.id, e.target.value)}
                className="text-[11px] bg-sand rounded-full px-2 py-1 outline-none"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="sold">Sold</option>
              </select>
              <button onClick={() => del(l.id)} className="text-[11px] text-destructive">Delete</button>
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
