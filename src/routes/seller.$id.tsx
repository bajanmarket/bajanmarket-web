import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { initials } from "@/lib/format";
import { parishLabel } from "@/lib/parishes";
import { useAuth } from "@/lib/useAuth";
import { ReportDialog } from "@/components/ReportDialog";
import { Flag } from "lucide-react";
import { ShareMenu } from "@/components/ShareMenu";
import { SellerTrust } from "@/components/SellerTrust";
import { sharePrefill } from "@/lib/share";

const SITE_URL = "https://bajanmarket.app";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio")
      .eq("id", params.id)
      .maybeSingle();
    return { profile: data };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.profile;
    const url = `${SITE_URL}/seller/${params.id}`;
    const name = p?.display_name ?? "Seller";
    const title = `${name} — Seller on BajanMarket`;
    const desc = (p?.bio ?? `Browse listings from ${name} on BajanMarket, Barbados' cleaner marketplace.`).slice(0, 155);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
    ];
    if (p?.avatar_url) meta.push({ property: "og:image", content: p.avatar_url });
    const scripts = p ? [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        mainEntity: { "@type": "Person", name, image: p.avatar_url ?? undefined, url },
      }),
    }] : undefined;
    return { meta, links: [{ rel: "canonical", href: url }], scripts };
  },
  component: Seller,
});

function Seller() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);

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

  const { data: storefront } = useQuery({
    queryKey: ["seller-storefront", id],
    queryFn: async () =>
      (await supabase.from("businesses").select("slug").eq("owner_id", id).eq("status", "approved").maybeSingle()).data,
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
        <div className="flex-1">
          <h1 className="text-xl font-medium">{profile.display_name}</h1>
          <div className="text-xs text-navy/50">
            {parishLabel(profile.parish)} · Joined {new Date(profile.created_at).toLocaleDateString("en-BB", { month: "short", year: "numeric" })}
          </div>
          <SellerTrust
            className="mt-2"
            data={{
              created_at: profile.created_at,
              last_active_at: profile.last_active_at,
              listings_count: profile.listings_count,
              activeCount: (listings ?? []).filter((l) => l.status === "active").length,
              soldCount: (listings ?? []).filter((l) => l.status === "sold").length,
              hasStorefront: !!storefront,
            }}
          />
          {profile.bio && <p className="text-sm text-navy/70 mt-2 max-w-md">{profile.bio}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareMenu
            url={`${SITE_URL}/seller/${id}`}
            title={profile.display_name ?? "Seller"}
            text={sharePrefill("seller", { title: profile.display_name ?? "Seller", name: profile.display_name ?? undefined })}
            source="seller"
          />
          {user?.id !== profile.id && (
            <button
              onClick={() => {
                if (!user) { nav({ to: "/auth", search: { redirect: `/seller/${id}` } }); return; }
                setReportOpen(true);
              }}
              className="ring-1 ring-hairline text-navy/60 hover:text-navy p-3 rounded-2xl"
              aria-label="Report seller"
              title="Report seller"
            >
              <Flag className="size-4" />
            </button>
          )}
        </div>
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={id} redirectPath={`/seller/${id}`} />

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
