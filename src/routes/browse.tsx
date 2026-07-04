import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SearchBar } from "@/components/SearchBar";
import { CategoryChips } from "@/components/CategoryChips";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { PARISHES } from "@/lib/parishes";
import { logSearchEvent } from "@/lib/logSearchEvent";
import type { Database } from "@/integrations/supabase/types";

const searchSchema = z.object({
  q: z.string().optional(),
  parish: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Browse listings — Bajan.market" },
      { name: "description", content: "Search and filter thousands of listings across Barbados by category, parish, and price." },
      { property: "og:title", content: "Browse listings — Bajan.market" },
      { property: "og:description", content: "Search and filter thousands of listings across Barbados by category, parish, and price." },
      { property: "og:url", content: "https://bajanmarketplacetest.lovable.app/browse" },
    ],
    links: [{ rel: "canonical", href: "https://bajanmarketplacetest.lovable.app/browse" }],
  }),
  component: Browse,
});

function Browse() {
  const search = Route.useSearch();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", "browse", search],
    queryFn: async () => {
      let categoryId: string | undefined;
      if (search.category) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", search.category)
          .maybeSingle();
        categoryId = cat?.id;
      }

      let q = supabase
        .from("listings")
        .select("id, title, price, currency, parish, condition, cover_image_url, status")
        .eq("status", "active");

      if (categoryId) q = q.eq("category_id", categoryId);
      if (search.parish) q = q.eq("parish", search.parish as never);
      if (search.min != null) q = q.gte("price", search.min);
      if (search.max != null) q = q.lte("price", search.max);
      if (search.q) q = q.ilike("title", `%${search.q}%`);

      switch (search.sort) {
        case "price_asc": q = q.order("price", { ascending: true }); break;
        case "price_desc": q = q.order("price", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q.limit(60);
      if (error) throw error;
      return (data ?? []) as ListingCardData[];
    },
  });

  const nav = Route.useNavigate();

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium text-navy">Browse listings across Barbados</h1>
        <SearchBar initialQuery={search.q ?? ""} initialParish={search.parish ?? ""} />
        <CategoryChips selected={search.category} />

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Sort listings"
            value={search.sort ?? "newest"}
            onChange={(e) => nav({ to: "/browse", search: { ...search, sort: e.target.value as "newest" | "price_asc" | "price_desc" } })}
            className="bg-white ring-1 ring-hairline rounded-full px-4 py-1.5 text-xs font-medium text-navy/70"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
          <select
            aria-label="Filter by parish"
            value={search.parish ?? ""}
            onChange={(e) => nav({ to: "/browse", search: { ...search, parish: e.target.value || undefined } })}
            className="bg-white ring-1 ring-hairline rounded-full px-4 py-1.5 text-xs font-medium text-navy/70"
          >
            <option value="">All parishes</option>
            {PARISHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 ring-1 ring-hairline">
                <div className="w-full aspect-[4/3] bg-sand-deep rounded-xl animate-pulse mb-3" />
                <div className="h-4 bg-sand-deep rounded animate-pulse mb-2" />
              </div>
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
            <h3 className="text-lg font-medium">No listings match your search.</h3>
            <p className="text-sm text-navy/60 mt-2">Try widening your filters, or check back soon.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
