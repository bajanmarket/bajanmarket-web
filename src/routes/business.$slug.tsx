import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { useAuth } from "@/lib/useAuth";
import { parishLabel } from "@/lib/parishes";
import { Mail, Phone, MessageCircle, Globe, MapPin, Clock, Star, Store } from "lucide-react";
import { toast } from "sonner";
import { ShareMenu } from "@/components/ShareMenu";
import { sharePrefill } from "@/lib/share";
import { TrustBadge } from "@/components/ci/TrustBadge";
import { emitEvent } from "@/lib/ci/track";
import { useEffect } from "react";

const SITE_URL = "https://bajanmarketplacetest.lovable.app";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export type BusinessHours = Record<string, { open: string; close: string; closed: boolean } | undefined>;

export const Route = createFileRoute("/business/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "approved")
      .maybeSingle();
    return { business: data };
  },
  head: ({ params, loaderData }) => {
    const b = loaderData?.business;
    const url = `${SITE_URL}/business/${params.slug}`;
    const title = b ? `${b.name} — Bajan.market` : "Business — Bajan.market";
    const desc = (b?.tagline ?? b?.description ?? `Shop with ${b?.name ?? "this business"} on Bajan.market.`)?.slice(0, 155) ?? "";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
    ];
    if (b?.banner_url) meta.push({ property: "og:image", content: b.banner_url });
    else if (b?.logo_url) meta.push({ property: "og:image", content: b.logo_url });
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  component: BusinessPage,
});

function BusinessPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: business } = useQuery({
    queryKey: ["business", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
  });

  const { data: listings } = useQuery({
    queryKey: ["business-listings", business?.owner_id],
    enabled: !!business?.owner_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status")
        .eq("seller_id", business!.owner_id)
        .in("status", ["active", "sold"])
        .order("created_at", { ascending: false });
      return (data ?? []) as ListingCardData[];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["business-reviews", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_reviews")
        .select("id, rating, body, created_at, reviewer_id")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const ids = Array.from(new Set(data.map((r) => r.reviewer_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
      return data.map((r) => ({ ...r, reviewer: pmap.get(r.reviewer_id) }));
    },
  });

  if (!business) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Store className="size-8 mx-auto text-navy/30" />
          <h1 className="text-xl font-medium mt-3">Business not found</h1>
          <p className="text-sm text-navy/60 mt-2">This storefront doesn't exist or isn't approved yet.</p>
          <Link to="/browse" className="inline-block mt-4 bg-navy text-white rounded-full px-4 py-2 text-sm font-medium">Browse listings</Link>
        </div>
      </AppShell>
    );
  }

  const hours = (business.hours ?? {}) as BusinessHours;
  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  const isOwner = user?.id === business.owner_id;

  return (
    <AppShell>
      {/* Banner + logo */}
      <div className="bg-white rounded-3xl ring-1 ring-hairline overflow-hidden mb-6">
        <div className="w-full aspect-[3/1] bg-sand-deep relative">
          {business.banner_url ? (
            <img src={business.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-teal-soft to-sand-deep" />
          )}
        </div>
        <div className="p-6 flex flex-col sm:flex-row gap-4 sm:items-end -mt-16 sm:-mt-20 relative">
          <div className="size-24 sm:size-32 rounded-2xl ring-4 ring-white bg-white overflow-hidden shrink-0 grid place-items-center">
            {business.logo_url ? (
              <img src={business.logo_url} alt={`${business.name} logo`} className="w-full h-full object-cover" />
            ) : (
              <Store className="size-10 text-navy/30" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold">{business.name}</h1>
            {business.tagline && <p className="text-sm text-navy/60 mt-1">{business.tagline}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-navy/50">
              {avgRating !== null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-teal text-teal" /> {avgRating.toFixed(1)} ({reviews!.length})
                </span>
              )}
              {business.parish && <span>{parishLabel(business.parish)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareMenu
              url={`${SITE_URL}/business/${slug}`}
              title={business.name}
              text={sharePrefill("storefront", { title: business.name, name: business.name })}
              source="storefront"
            />
            {isOwner && (
              <Link to="/business" className="text-xs bg-sand ring-1 ring-hairline rounded-full px-3 py-1.5">
                Edit storefront
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {business.description && (
            <section className="bg-white rounded-3xl ring-1 ring-hairline p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-2">About</h2>
              <p className="text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">{business.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3">Catalog</h2>
            {listings && listings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center text-sm text-navy/60">
                No products listed yet.
              </div>
            )}
          </section>

          <section className="bg-white rounded-3xl ring-1 ring-hairline p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50">Reviews</h2>
            </div>
            <ReviewForm
              businessId={business.id}
              canReview={!!user && !isOwner}
              existing={reviews?.find((r) => r.reviewer_id === user?.id)}
              onDone={() => qc.invalidateQueries({ queryKey: ["business-reviews", business.id] })}
              onNeedAuth={() => nav({ to: "/auth", search: { redirect: `/business/${slug}` } })}
            />
            <div className="flex flex-col gap-4 mt-4">
              {reviews && reviews.length > 0 ? reviews.map((r) => (
                <div key={r.id} className="flex gap-3 pb-4 border-b border-hairline last:border-0 last:pb-0">
                  <div className="size-9 rounded-full bg-sand-deep overflow-hidden shrink-0">
                    {r.reviewer?.avatar_url && <img src={r.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-navy">{r.reviewer?.display_name ?? "Someone"}</span>
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`size-3 ${i < r.rating ? "fill-teal text-teal" : "text-navy/20"}`} />
                        ))}
                      </span>
                      <span className="text-navy/40">{new Date(r.created_at).toLocaleDateString("en-BB", { month: "short", year: "numeric" })}</span>
                    </div>
                    {r.body && <p className="text-sm text-navy/80 mt-1 whitespace-pre-wrap">{r.body}</p>}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-navy/50">No reviews yet.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3">Contact</h3>
            <div className="flex flex-col gap-2 text-sm">
              {business.contact_email && (
                <a href={`mailto:${business.contact_email}`} className="flex items-center gap-2 text-navy hover:text-teal">
                  <Mail className="size-4 text-navy/40" /> {business.contact_email}
                </a>
              )}
              {business.contact_phone && (
                <a href={`tel:${business.contact_phone}`} className="flex items-center gap-2 text-navy hover:text-teal">
                  <Phone className="size-4 text-navy/40" /> {business.contact_phone}
                </a>
              )}
              {business.whatsapp && (
                <a href={`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-navy hover:text-teal">
                  <MessageCircle className="size-4 text-navy/40" /> WhatsApp
                </a>
              )}
              {business.website && (
                <a href={business.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-navy hover:text-teal truncate">
                  <Globe className="size-4 text-navy/40 shrink-0" /> <span className="truncate">{business.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
              {business.address && (
                <div className="flex items-start gap-2 text-navy/70">
                  <MapPin className="size-4 text-navy/40 mt-0.5 shrink-0" /> <span>{business.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl ring-1 ring-hairline p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3 flex items-center gap-1.5">
              <Clock className="size-3.5" /> Hours
            </h3>
            <div className="flex flex-col gap-1.5 text-sm">
              {DAYS.map((d) => {
                const h = hours[d.key];
                return (
                  <div key={d.key} className="flex justify-between">
                    <span className="text-navy/60 w-12">{d.label}</span>
                    <span className="text-navy">
                      {!h || h.closed ? <span className="text-navy/40">Closed</span> : `${h.open} – ${h.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function ReviewForm({
  businessId, canReview, existing, onDone, onNeedAuth,
}: {
  businessId: string;
  canReview: boolean;
  existing: { id: string; rating: number; body: string | null } | undefined;
  onDone: () => void;
  onNeedAuth: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");

  const submit = useMutation({
    mutationFn: async () => {
      if (rating < 1) throw new Error("Pick a rating first");
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) throw new Error("Sign in required");
      if (existing) {
        const { error } = await supabase.from("business_reviews")
          .update({ rating, body: body || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_reviews")
          .insert({ business_id: businessId, reviewer_id: session.user.id, rating, body: body || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(existing ? "Review updated" : "Thanks for your review!"); onDone(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!canReview && !existing) {
    return (
      <button onClick={onNeedAuth} className="w-full bg-sand ring-1 ring-hairline rounded-2xl py-3 text-sm font-medium">
        Sign in to leave a review
      </button>
    );
  }

  return (
    <div className="bg-sand rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i + 1)}
            className="p-1"
            aria-label={`${i + 1} star${i ? "s" : ""}`}
          >
            <Star className={`size-6 ${i < rating ? "fill-teal text-teal" : "text-navy/25"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={800}
        rows={3}
        placeholder="Share your experience (optional)"
        className="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal"
      />
      <button
        onClick={() => submit.mutate()}
        disabled={submit.isPending || rating < 1}
        className="bg-navy text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 self-end px-5"
      >
        {submit.isPending ? "Saving…" : existing ? "Update review" : "Post review"}
      </button>
    </div>
  );
}
