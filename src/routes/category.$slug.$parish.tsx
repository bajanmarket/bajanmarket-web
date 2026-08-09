import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { parishFromSlug, parishLabel } from "@/lib/parishes";
import { SITE_URL, BRAND, NOINDEX } from "@/lib/site";

export const Route = createFileRoute("/category/$slug/$parish")({
  loader: async ({ params }) => {
    const parish = parishFromSlug(params.parish);
    if (!parish) throw notFound();
    const { data: category } = await supabase
      .from("categories")
      .select("id, slug, name")
      .eq("slug", params.slug)
      .eq("active", true)
      .maybeSingle();
    if (!category) throw notFound();
    const { count } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("category_id", category.id)
      .eq("parish", parish as never);
    return { category, parish, count: count ?? 0 };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.category.name ?? "Listings";
    const label = parishLabel(loaderData?.parish);
    const url = `${SITE_URL}/category/${params.slug}/${params.parish}`;
    const title = `${name} in ${label}, Barbados — ${BRAND}`;
    const desc = `${name} for sale in ${label}, Barbados. Browse local listings on ${BRAND} and message sellers directly.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    // Thin pages with no real inventory stay out of the index.
    if ((loaderData?.count ?? 0) === 0) meta.push(NOINDEX);
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: BRAND, item: SITE_URL },
              { "@type": "ListItem", position: 2, name, item: `${SITE_URL}/category/${params.slug}` },
              { "@type": "ListItem", position: 3, name: label, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: ParishLanding,
});

function ParishLanding() {
  const { slug } = Route.useParams();
  const { category, parish } = Route.useLoaderData();
  const label = parishLabel(parish);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["category-parish-listings", category.id, parish],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status")
        .eq("status", "active")
        .eq("category_id", category.id)
        .eq("parish", parish as never)
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) throw error;
      return (data ?? []) as ListingCardData[];
    },
  });

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="text-xs text-navy/50 mb-3">
        <Link to="/" className="hover:text-teal">{BRAND}</Link>
        <span className="mx-1.5">›</span>
        <Link to="/category/$slug" params={{ slug }} className="hover:text-teal">{category.name}</Link>
        <span className="mx-1.5">›</span>
        <span className="text-navy/70">{label}</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-navy">
        {category.name} in {label}
      </h1>
      <p className="text-sm text-navy/60 mt-3 max-w-2xl">
        Local {category.name.toLowerCase()} listings in {label}. Buying close to home makes pickup easy —
        message the seller on {BRAND} and sort out a time that suits you both.
      </p>

      <section className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 ring-1 ring-hairline">
                <div className="w-full aspect-[4/3] bg-sand-deep rounded-xl animate-pulse mb-3" />
                <div className="h-4 bg-sand-deep rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 4} />)}
          </div>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center">
            <h3 className="text-lg font-medium text-navy">No {category.name.toLowerCase()} in {label} yet.</h3>
            <p className="text-sm text-navy/60 mt-2">Be the first to list something in your parish.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to="/post"
                className="inline-flex items-center rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium"
              >
                Post a free listing
              </Link>
              <Link
                to="/category/$slug"
                params={{ slug }}
                className="inline-flex items-center rounded-2xl bg-white ring-1 ring-hairline px-5 py-2.5 text-sm font-medium text-navy"
              >
                All {category.name.toLowerCase()}
              </Link>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
