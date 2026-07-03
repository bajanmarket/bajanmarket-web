import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SearchBar } from "@/components/SearchBar";
import { CategoryChips, CategoryGrid } from "@/components/CategoryChips";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { SellerOnboarding } from "@/components/SellerOnboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bajan.market — Barbados' cleaner marketplace" },
      { name: "description", content: "Buy and sell across Barbados. Vehicles, property, electronics, furniture, jobs, road tennis and more." },
      { property: "og:title", content: "Bajan.market — Barbados' cleaner marketplace" },
      { property: "og:description", content: "Buy and sell across Barbados. Vehicles, property, electronics, furniture, jobs, road tennis and more." },
      { property: "og:url", content: "https://bajanmarketplacetest.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://bajanmarketplacetest.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Bajan.market",
          url: "https://bajanmarketplacetest.lovable.app/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://bajanmarketplacetest.lovable.app/browse?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Bajan.market",
          url: "https://bajanmarketplacetest.lovable.app/",
          areaServed: "Barbados",
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", "home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as ListingCardData[];
    },
  });

  return (
    <AppShell>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl sm:text-5xl font-medium tracking-tight text-navy text-balance leading-tight">
            Find your next local gem <br className="hidden sm:block" />
            in the heart of Barbados.
          </h1>
          <p className="text-navy/60 text-sm sm:text-base max-w-xl">
            Cleaner than the Facebook groups. Safer than a car park meet. Faster than a WhatsApp back-and-forth.
          </p>
        </div>

        <SearchBar />
        <CategoryChips />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-4">Browse categories</h2>
        <CategoryGrid />
      </section>

      <section className="mt-12 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-navy">Recent listings</h2>
          <Link to="/browse" className="text-sm font-medium text-teal hover:text-teal/80">View all</Link>
        </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <EmptyMarketplace />
        )}
      </section>
    </AppShell>
  );
}

function EmptyMarketplace() {
  return (
    <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
      <h3 className="text-lg font-medium text-navy">The marketplace is fresh.</h3>
      <p className="text-sm text-navy/60 mt-2 max-w-md mx-auto">
        Be one of the first Bajans to list something. Whether it's a Suzuki Swift, a mahogany dining set, or a road tennis paddle — post it and the island will find it.
      </p>
      <Link
        to="/post"
        className="inline-flex mt-6 items-center rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium active:scale-95 transition-transform"
      >
        Post the first listing
      </Link>
    </div>
  );
}
