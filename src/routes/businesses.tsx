import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PARISHES, parishLabel } from "@/lib/parishes";
import { SITE_URL, BRAND } from "@/lib/site";
import { Store, MapPin, Search } from "lucide-react";

const TITLE = `Barbados business directory — ${BRAND}`;
const DESC =
  "Browse verified Barbadian shops, service providers and family businesses with storefronts on BajanMarket. Find them by parish and contact them directly.";

export const Route = createFileRoute("/businesses")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/businesses` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/businesses` }],
  }),
  component: BusinessDirectory,
});

type Row = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  parish: string | null;
};

function BusinessDirectory() {
  const [parish, setParish] = useState<string>("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["business-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, slug, name, tagline, logo_url, banner_url, parish")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const term = q.trim().toLowerCase();
  const businesses = (data ?? []).filter(
    (b) =>
      (!parish || b.parish === parish) &&
      (!term ||
        b.name.toLowerCase().includes(term) ||
        (b.tagline ?? "").toLowerCase().includes(term)),
  );

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="text-xs text-navy/50 mb-3">
        <Link to="/" className="hover:text-teal">
          {BRAND}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-navy/70">Businesses</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-navy">
        Barbados business directory
      </h1>
      <p className="text-sm text-navy/60 mt-3 max-w-2xl">
        Local shops, tradespeople and family businesses with a storefront on {BRAND}. Every
        storefront here has been reviewed by our team before going live.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-navy/35" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search businesses"
            aria-label="Search businesses"
            className="w-full bg-white rounded-2xl ring-1 ring-hairline pl-10 pr-4 py-3 text-sm outline-none focus:ring-teal"
          />
        </div>
        <select
          value={parish}
          onChange={(e) => setParish(e.target.value)}
          aria-label="Filter by parish"
          className="bg-white rounded-2xl ring-1 ring-hairline px-4 py-3 text-sm outline-none focus:ring-teal"
        >
          <option value="">All parishes</option>
          {PARISHES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-8">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl ring-1 ring-hairline p-5">
                <div className="size-12 rounded-2xl bg-sand-deep animate-pulse mb-3" />
                <div className="h-4 bg-sand-deep rounded animate-pulse w-2/3" />
              </div>
            ))}
          </div>
        ) : businesses.length > 0 ? (
          <>
            <p className="text-sm text-navy/60 mb-4">
              {businesses.length} business{businesses.length === 1 ? "" : "es"}
              {parish ? ` in ${parishLabel(parish)}` : " across Barbados"}
            </p>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {businesses.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/business/$slug"
                    params={{ slug: b.slug }}
                    className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex items-start gap-4 h-full hover:ring-teal/40 transition"
                  >
                    <div className="size-12 rounded-2xl bg-sand-deep grid place-items-center overflow-hidden shrink-0 text-navy/40">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Store className="size-5" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-medium text-navy truncate">{b.name}</h2>
                      {b.tagline && (
                        <p className="text-sm text-navy/60 mt-1 line-clamp-2">{b.tagline}</p>
                      )}
                      {b.parish && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-navy/50">
                          <MapPin className="size-3" aria-hidden />
                          {parishLabel(b.parish)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
            <div className="mx-auto size-14 rounded-full bg-teal-soft grid place-items-center text-teal mb-3">
              <Store className="size-6" aria-hidden />
            </div>
            <h2 className="text-lg font-medium text-navy">
              {data && data.length > 0 ? "No businesses match that search." : "No storefronts listed yet."}
            </h2>
            <p className="text-sm text-navy/60 mt-2 mb-5 max-w-md mx-auto">
              {data && data.length > 0
                ? "Try a different parish or clear your search."
                : `Run a business in Barbados? Set up a free storefront on ${BRAND} and get found by local customers.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {data && data.length > 0 ? (
                <button
                  onClick={() => {
                    setQ("");
                    setParish("");
                  }}
                  className="rounded-2xl bg-white ring-1 ring-hairline px-5 py-2.5 text-sm font-medium text-navy"
                >
                  Clear filters
                </button>
              ) : null}
              <Link
                to="/business"
                className="inline-flex items-center rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium"
              >
                Create a storefront
              </Link>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
