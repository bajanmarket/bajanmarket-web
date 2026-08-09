import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SearchBar } from "@/components/SearchBar";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { PARISH_SLUGS } from "@/lib/parishes";
import { SITE_URL, BRAND } from "@/lib/site";
import { CategoryIcon } from "@/components/CategoryIcon";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const { data: category } = await supabase
      .from("categories")
      .select("id, slug, name, icon")
      .eq("slug", params.slug)
      .eq("active", true)
      .maybeSingle();
    if (!category) throw notFound();
    const { count } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("category_id", category.id);
    return { category, count: count ?? 0 };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.category.name ?? "Listings";
    const url = `${SITE_URL}/category/${params.slug}`;
    const title = `${name} for sale in Barbados — ${BRAND}`;
    const desc = `Browse ${name.toLowerCase()} for sale across Barbados on ${BRAND}. Real listings from local sellers in every parish, priced in BBD.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: BRAND, item: SITE_URL },
              { "@type": "ListItem", position: 2, name, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: CategoryLanding,
});

function CategoryLanding() {
  const { slug } = Route.useParams();
  const { category } = Route.useLoaderData();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["category-listings", category.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status")
        .eq("status", "active")
        .eq("category_id", category.id)
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) throw error;
      return (data ?? []) as ListingCardData[];
    },
  });

  const parishesWithStock = new Set((listings ?? []).map((l) => l.parish));

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="text-xs text-navy/50 mb-3">
        <Link to="/" className="hover:text-teal">{BRAND}</Link>
        <span className="mx-1.5">›</span>
        <span className="text-navy/70">{category.name}</span>
      </nav>

      <div className="flex items-center gap-3">
        <span className="size-11 rounded-2xl bg-white ring-1 ring-hairline grid place-items-center">
          <CategoryIcon name={category.icon} className="size-5 text-teal" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-navy">
          {category.name} in Barbados
        </h1>
      </div>
      <p className="text-sm text-navy/60 mt-3 max-w-2xl">
        Every {category.name.toLowerCase()} listing on {BRAND} comes straight from a local seller, priced in
        Barbados dollars. Message sellers in-platform, arrange pickup on island, and skip the endless
        Facebook group scrolling.
      </p>

      <div className="mt-5">
        <SearchBar />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-4">
          Latest {category.name.toLowerCase()} listings
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 ring-1 ring-hairline">
                <div className="w-full aspect-[4/3] bg-sand-deep rounded-xl animate-pulse mb-3" />
                <div className="h-4 bg-sand-deep rounded animate-pulse mb-2" />
                <div className="h-3 bg-sand-deep rounded animate-pulse w-2/3" />
              </div>
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 4} />)}
            </div>
            <Link
              to="/browse"
              search={{ category: slug }}
              className="inline-flex mt-6 items-center rounded-2xl bg-white ring-1 ring-hairline px-5 py-2.5 text-sm font-medium text-navy"
            >
              See all {category.name.toLowerCase()} listings
            </Link>
          </>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center">
            <h3 className="text-lg font-medium text-navy">Nothing here yet.</h3>
            <p className="text-sm text-navy/60 mt-2">
              Be the first to list {category.name.toLowerCase()} on {BRAND}.
            </p>
            <Link
              to="/post"
              className="inline-flex mt-5 items-center rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium active:scale-95 transition-transform"
            >
              Post a free listing
            </Link>
          </div>
        )}
      </section>

      {parishesWithStock.size > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3">
            {category.name} by parish
          </h2>
          <div className="flex flex-wrap gap-2">
            {PARISH_SLUGS.filter((p) => parishesWithStock.has(p.value)).map((p) => (
              <Link
                key={p.value}
                to="/category/$slug/$parish"
                params={{ slug, parish: p.slug }}
                className="px-4 py-1.5 rounded-full bg-white ring-1 ring-hairline text-xs font-medium text-navy/70 hover:ring-teal/40"
              >
                {category.name} in {p.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
