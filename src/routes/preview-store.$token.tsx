import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store, MapPin, Globe, Phone, MessageCircle, Mail, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { getStorePreview } from "@/lib/draftStore.functions";
import { parishLabel } from "@/lib/parishes";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/preview-store/$token")({
  head: () => ({
    meta: [
      { title: "Your BajanMarket storefront preview" },
      {
        name: "description",
        content: "A private preview of the BajanMarket storefront we prepared for your business. Claim it to review and publish.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your BajanMarket storefront is ready" },
      { property: "og:description", content: "Preview the storefront we prepared for your business, then claim it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PreviewStorePage,
});

function PreviewStorePage() {
  const { token } = Route.useParams();
  const fetchPreview = useServerFn(getStorePreview);

  const { data, isLoading } = useQuery({
    queryKey: ["store-preview", token],
    queryFn: () => fetchPreview({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return <Centered><p className="text-sm text-navy/50">Loading your storefront preview…</p></Centered>;
  }

  if (!data?.ok) {
    return (
      <Centered>
        <Store className="size-8 mx-auto text-navy/30" />
        <h1 className="text-xl font-medium mt-3">Preview unavailable</h1>
        <p className="text-sm text-navy/60 mt-2">{data?.error ?? "This link is no longer valid."}</p>
        <Link to="/" className="inline-block mt-4 bg-navy text-white rounded-full px-4 py-2 text-sm font-medium">
          Visit BajanMarket
        </Link>
      </Centered>
    );
  }

  const { store, items } = data;
  const products = items.filter((i) => i.content_type === "product" || i.content_type === "service");
  const social = items.filter((i) => i.content_type !== "product" && i.content_type !== "service");
  const claimHref = `/auth?claim=${token}&redirect=${encodeURIComponent(`/claim/${token}`)}`;

  return (
    <div className="min-h-screen bg-sand pb-28">
      <header className="px-5 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-navy tracking-tight">
          Bajan<span className="text-teal">.market</span>
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-white ring-1 ring-hairline rounded-full px-2 py-1 text-navy/60">
          Private preview
        </span>
      </header>

      <main className="px-4 max-w-3xl mx-auto flex flex-col gap-5">
        <section className="bg-white rounded-3xl ring-1 ring-hairline p-6 text-center">
          <Sparkles className="size-6 mx-auto text-teal" />
          <h1 className="text-2xl font-semibold mt-2">Your BajanMarket storefront is ready</h1>
          <p className="text-sm text-navy/60 mt-2 leading-relaxed">
            We've prepared your BajanMarket business storefront using publicly available information about{" "}
            {store.business_name}. Create your account, review the information and choose what you want to publish.
          </p>
          <p className="text-xs text-navy/40 mt-3">
            Nothing here is public yet — this storefront only goes live once you claim and publish it.
          </p>
          <a
            href={claimHref}
            className="mt-5 inline-flex w-full sm:w-auto justify-center items-center bg-navy text-white rounded-full px-6 py-3.5 text-sm font-semibold"
          >
            Claim &amp; approve store
          </a>
        </section>

        {/* Storefront preview — mirrors the live storefront design */}
        <section className="bg-white rounded-3xl ring-1 ring-hairline overflow-hidden">
          <div className="w-full aspect-[3/1] bg-sand-deep">
            {store.cover_url ? (
              <img src={store.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-teal-soft to-sand-deep" />
            )}
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-4 sm:items-end -mt-16 sm:-mt-20 relative">
            <div className="size-24 rounded-2xl ring-4 ring-white bg-white overflow-hidden shrink-0 grid place-items-center">
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store className="size-9 text-navy/30" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{store.business_name}</h2>
              {store.tagline && <p className="text-sm text-navy/60 mt-1">{store.tagline}</p>}
              {store.parish && (
                <p className="text-xs text-navy/50 mt-2 inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {parishLabel(store.parish) ?? store.parish}
                </p>
              )}
            </div>
          </div>

          {store.description && (
            <div className="px-6 pb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy/50 mb-2">About</h3>
              <p className="text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">{store.description}</p>
            </div>
          )}

          <div className="px-6 pb-6 flex flex-wrap gap-2 text-xs">
            {store.whatsapp && <Pill icon={MessageCircle} text="WhatsApp" />}
            {store.contact_phone && <Pill icon={Phone} text={store.contact_phone} />}
            {store.contact_email && <Pill icon={Mail} text={store.contact_email} />}
            {store.website && <Pill icon={Globe} text="Website" />}
            {store.hours ? <Pill icon={Clock} text="Opening hours" /> : null}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3 px-1">
            Products &amp; services we prepared
          </h3>
          {products.length === 0 ? (
            <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center text-sm text-navy/60">
              No products drafted yet — you can add them after you claim the store.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <article key={p.id} className="bg-white rounded-2xl ring-1 ring-hairline overflow-hidden">
                  <div className="aspect-square bg-sand-deep grid place-items-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="size-7 text-navy/20" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{p.title}</p>
                    <p className="text-sm mt-1 text-navy/70">
                      {p.price !== null && p.price !== undefined
                        ? formatPrice(p.price, p.currency ?? "BBD")
                        : "Contact seller for price"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {social.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3 px-1">Recent business content</h3>
            <div className="flex flex-col gap-2">
              {social.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4">
                  <p className="text-sm font-medium">{s.title}</p>
                  {s.description && <p className="text-xs text-navy/60 mt-1 leading-relaxed">{s.description}</p>}
                  <p className="text-[11px] text-navy/40 mt-2 capitalize">{s.content_type}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-navy/45 leading-relaxed px-1 flex gap-2">
          <ShieldCheck className="size-4 shrink-0 text-navy/30" />
          This draft was prepared from publicly available business information. You choose what gets published —
          nothing is republished without your approval.
        </p>
      </main>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-sand via-sand to-transparent">
        <a
          href={claimHref}
          className="block max-w-3xl mx-auto text-center bg-navy text-white rounded-full px-6 py-4 text-sm font-semibold shadow-lg"
        >
          Claim your store
        </a>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: typeof Phone; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-sand rounded-full px-3 py-1.5 text-navy/70">
      <Icon className="size-3.5" /> {text}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand grid place-items-center px-5">
      <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center max-w-sm w-full">{children}</div>
    </div>
  );
}
