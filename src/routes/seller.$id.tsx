import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { initials } from "@/lib/format";
import { parishLabel } from "@/lib/parishes";

export const Route = createFileRoute("/seller/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Seller — Bajan.market` },
      { name: "description", content: `Listings from this Bajan.market seller (${params.id}).` },
    ],
  }),
  component: Seller,
});

function Seller() {
  const { id } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["seller-profile", id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: listings } = useQuery({
    queryKey: ["seller-listings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status")
        .eq("seller_id", id)
        .in("status", ["active", "sold"])
        .order("created_at", { ascending: false });
      return (data ?? []) as ListingCardData[];
    },
  });

  if (!profile) return <AppShell><div className="py-20 text-center">Seller not found.</div></AppShell>;

  return (
    <AppShell>
      <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex items-center gap-4 mb-6">
        <div className="size-16 rounded-full bg-sand-deep grid place-items-center overflow-hidden text-lg font-semibold text-navy/60">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : initials(profile.display_name)}
        </div>
        <div>
          <div className="text-xl font-medium">{profile.display_name}</div>
          <div className="text-xs text-navy/50">
            {parishLabel(profile.parish)} · Joined {new Date(profile.created_at).toLocaleDateString("en-BB", { month: "short", year: "numeric" })}
          </div>
          {profile.bio && <p className="text-sm text-navy/70 mt-2 max-w-md">{profile.bio}</p>}
        </div>
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3">Listings</h2>
      {listings && listings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center text-sm text-navy/60">
          No listings from this seller yet.
        </div>
      )}
    </AppShell>
  );
}
