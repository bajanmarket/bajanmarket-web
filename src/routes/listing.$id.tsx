import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { formatBBD, formatRelative, initials } from "@/lib/format";
import { parishLabel, conditionLabel } from "@/lib/parishes";
import { useAuth } from "@/lib/useAuth";
import { Heart, Flag, MessageCircle, Eye, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/ReportDialog";
import { ShareMenu } from "@/components/ShareMenu";
import { sharePrefill } from "@/lib/share";
import { emitEvent } from "@/lib/ci/track";
import { TrustBadge } from "@/components/ci/TrustBadge";

const SITE_URL = "https://bajanmarketplacetest.lovable.app";

export const Route = createFileRoute("/listing/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("listings")
      .select("id, title, description, price, currency, cover_image_url")
      .eq("id", params.id)
      .maybeSingle();
    return { listing: data };
  },
  head: ({ params, loaderData }) => {
    const l = loaderData?.listing;
    const url = `${SITE_URL}/listing/${params.id}`;
    const title = l ? `${l.title} — ${formatBBD(l.price, l.currency)} · Bajan.market` : "Listing — Bajan.market";
    const desc = l
      ? (l.description ?? "").replace(/\s+/g, " ").trim().slice(0, 155) || `${l.title} for sale on Bajan.market.`
      : "View this listing on Bajan.market — Barbados' cleaner marketplace.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
    ];
    if (l?.cover_image_url) meta.push({ property: "og:image", content: l.cover_image_url }, { name: "twitter:image", content: l.cover_image_url });
    const scripts = l ? [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: l.title,
        description: l.description ?? undefined,
        image: l.cover_image_url ?? undefined,
        offers: { "@type": "Offer", price: l.price, priceCurrency: l.currency ?? "BBD", url, availability: "https://schema.org/InStock" },
      }),
    }] : undefined;
    return { meta, links: [{ rel: "canonical", href: url }], scripts };
  },
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [activeImg, setActiveImg] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data: listing, error } = await supabase
        .from("listings")
        .select(`
          id, title, description, price, currency, negotiable, condition, parish,
          status, views, cover_image_url, created_at, seller_id,
          listing_images (id, url, sort_order),
          categories (name, slug)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!listing) return null;
      const { data: seller } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at")
        .eq("id", listing.seller_id)
        .maybeSingle();
      return { ...listing, seller };
    },
  });

  // Increment view count once per session per listing
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    const key = `viewed:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_listing_view", { _listing_id: id }).then(() => {
      // silent; don't refetch — counts are eventually consistent
    });
  }, [id]);

  const { data: isFav } = useQuery({
    queryKey: ["fav", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favourites")
        .select("listing_id")
        .eq("listing_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const favToggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      if (isFav) {
        await supabase.from("favourites").delete().eq("listing_id", id).eq("user_id", user.id);
      } else {
        await supabase.from("favourites").insert({ listing_id: id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fav", id] }),
    onError: () => nav({ to: "/auth", search: { redirect: `/listing/${id}` } }),
  });

  const contact = useMutation({
    mutationFn: async () => {
      if (!user) { nav({ to: "/auth", search: { redirect: `/listing/${id}` } }); return; }
      if (!data) return;
      if (data.seller_id === user.id) { toast.error("That's your listing."); return; }
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", id)
        .eq("buyer_id", user.id)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ listing_id: id, buyer_id: user.id, seller_id: data.seller_id })
          .select("id")
          .single();
        if (error) throw error;
        convId = created.id;
      }
      nav({ to: "/messages/$id", params: { id: convId! } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AppShell><div className="animate-pulse space-y-4">
    <div className="w-full aspect-[4/5] bg-sand-deep rounded-3xl" />
    <div className="h-8 bg-sand-deep rounded w-2/3" />
    <div className="h-4 bg-sand-deep rounded w-1/3" />
  </div></AppShell>;

  if (!data) return <AppShell><div className="text-center py-20">Listing not found.</div></AppShell>;

  const gallery = [
    ...(data.cover_image_url ? [{ id: "cover", url: data.cover_image_url }] : []),
    ...(data.listing_images ?? []).sort((a, b) => a.sort_order - b.sort_order),
  ];
  const currentUrl = gallery[activeImg]?.url;
  const seller = data.seller;

  const shareUrl = `${SITE_URL}/listing/${id}`;
  const shareText = sharePrefill("listing", { title: data.title, price: formatBBD(data.price, data.currency) });

  const openReport = () => {
    if (!user) { nav({ to: "/auth", search: { redirect: `/listing/${id}` } }); return; }
    setReportOpen(true);
  };



  return (
    <AppShell>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-3xl overflow-hidden ring-1 ring-hairline">
            <div className="w-full aspect-[4/3] bg-sand-deep grid place-items-center">
              {currentUrl ? (
                <img src={currentUrl} alt={data.title} className="w-full h-full object-cover" />
              ) : (
                <ImageOff className="size-12 text-navy/20" />
              )}
            </div>
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {gallery.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 size-16 rounded-xl overflow-hidden ring-2 transition-all ${
                    i === activeImg ? "ring-teal" : "ring-transparent opacity-70"
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 sm:p-8 lg:sticky lg:top-24 flex flex-col gap-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-medium text-navy text-balance">{data.title}</h1>
                <button
                  onClick={() => favToggle.mutate()}
                  className={`p-2 rounded-full transition-colors ${isFav ? "text-coral bg-coral-soft" : "text-navy/40 hover:bg-sand"}`}
                  aria-label="Save"
                >
                  <Heart className="size-5" fill={isFav ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="flex items-center flex-wrap gap-3 mt-2">
                <span className="text-2xl font-semibold text-navy">{formatBBD(data.price, data.currency)}</span>
                {data.negotiable && <span className="text-xs font-medium text-teal">Negotiable</span>}
                <span className="text-xs font-medium text-navy/40">{formatRelative(data.created_at)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 py-4 border-y border-hairline text-center">
              <Meta label="Parish" value={parishLabel(data.parish)} />
              <Meta label="Condition" value={conditionLabel(data.condition)} />
              <Meta label="Views" value={<span className="inline-flex items-center gap-1"><Eye className="size-3" /> {data.views}</span>} />
            </div>

            <p className="text-sm text-navy/70 leading-relaxed whitespace-pre-wrap">{data.description}</p>

            {seller && (
              <Link
                to="/seller/$id"
                params={{ id: seller.id }}
                className="flex items-center justify-between p-4 rounded-2xl bg-sand ring-1 ring-hairline"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-white ring-1 ring-hairline grid place-items-center overflow-hidden text-xs font-semibold text-navy/50">
                    {seller.avatar_url
                      ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initials(seller.display_name)}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">{seller.display_name}</span>
                    <span className="text-[11px] text-navy/40">
                      Joined {new Date(seller.created_at).toLocaleDateString("en-BB", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium text-teal">View</span>
              </Link>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => contact.mutate()}
                disabled={contact.isPending || data.status !== "active"}
                className="flex-1 bg-coral text-white text-sm font-semibold py-3 rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MessageCircle className="size-4" />
                {data.status === "sold" ? "Sold" : "Message seller"}
              </button>
              <ShareMenu url={shareUrl} title={data.title} text={shareText} source="listing" />
              <button onClick={openReport} className="bg-white ring-1 ring-hairline text-navy/60 p-3 rounded-2xl" aria-label="Report">
                <Flag className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="listing" targetId={id} redirectPath={`/listing/${id}`} />
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-navy/40 font-medium">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
