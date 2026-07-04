import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PARISHES } from "@/lib/parishes";
import { formatPrice } from "@/lib/format";
import { TrendingUp, Search, AlertCircle, MapPin, Tag, Eye } from "lucide-react";

type Days = 7 | 30;

export function InsightsPanel() {
  const [days, setDays] = useState<Days>(7);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
        {[7, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d as Days)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              days === d ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopSearchesCard sinceIso={sinceIso} />
        <ZeroResultsCard sinceIso={sinceIso} />
        <TopCategoriesCard sinceIso={sinceIso} />
        <TopParishesCard sinceIso={sinceIso} />
        <TrendingListingsCard sinceIso={sinceIso} className="lg:col-span-2" />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl ring-1 ring-hairline p-5 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-teal" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-navy/50 -mt-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-xs text-navy/40 py-2">{text}</div>;
}

function TopSearchesCard({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["insights-top-searches", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_events")
        .select("query, result_count")
        .gte("created_at", sinceIso)
        .limit(1000);
      if (error) throw error;

      const map = new Map<string, { count: number; withResults: number }>();
      for (const row of data ?? []) {
        const key = row.query.trim().toLowerCase();
        if (!key) continue;
        const cur = map.get(key) ?? { count: 0, withResults: 0 };
        cur.count += 1;
        if (row.result_count > 0) cur.withResults += 1;
        map.set(key, cur);
      }
      return Array.from(map.entries())
        .map(([q, v]) => ({ q, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  return (
    <Card icon={Search} title="Top searches" subtitle="Most common queries in the window">
      {isLoading ? (
        <EmptyRow text="Loading…" />
      ) : !data || data.length === 0 ? (
        <EmptyRow text="No searches logged yet." />
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((r) => (
            <li key={r.q} className="flex items-center justify-between text-sm py-1">
              <Link
                to="/browse"
                search={{ q: r.q }}
                className="truncate hover:underline text-navy"
              >
                {r.q}
              </Link>
              <span className="text-xs text-navy/60 shrink-0 ml-3">
                {r.count}× · {r.withResults > 0 ? `${r.withResults} w/ results` : (
                  <span className="text-coral font-semibold">0 results</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ZeroResultsCard({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["insights-zero-searches", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_events")
        .select("query")
        .eq("result_count", 0)
        .gte("created_at", sinceIso)
        .limit(1000);
      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const key = row.query.trim().toLowerCase();
        if (!key) continue;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([q, count]) => ({ q, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  return (
    <Card
      icon={AlertCircle}
      title="Unmet demand"
      subtitle="Searches that returned nothing — sellers to recruit"
    >
      {isLoading ? (
        <EmptyRow text="Loading…" />
      ) : !data || data.length === 0 ? (
        <EmptyRow text="No zero-result searches. Nice." />
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((r) => (
            <li key={r.q} className="flex items-center justify-between text-sm py-1">
              <span className="truncate text-navy">{r.q}</span>
              <span className="text-xs text-coral font-semibold shrink-0 ml-3">{r.count}×</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TopCategoriesCard({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["insights-top-categories", sinceIso],
    queryFn: async () => {
      const [{ data: cats }, { data: listings }] = await Promise.all([
        supabase.from("categories").select("id, name, slug"),
        supabase
          .from("listings")
          .select("category_id, views, favourite_count")
          .eq("status", "active")
          .gte("created_at", sinceIso)
          .limit(2000),
      ]);
      const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
      const agg = new Map<string, { name: string; slug: string; listings: number; views: number; favs: number }>();
      for (const l of listings ?? []) {
        const cat = catMap.get(l.category_id);
        if (!cat) continue;
        const cur = agg.get(cat.id) ?? { name: cat.name, slug: cat.slug, listings: 0, views: 0, favs: 0 };
        cur.listings += 1;
        cur.views += l.views ?? 0;
        cur.favs += l.favourite_count ?? 0;
        agg.set(cat.id, cur);
      }
      return Array.from(agg.values())
        .sort((a, b) => b.views + b.favs * 3 - (a.views + a.favs * 3))
        .slice(0, 8);
    },
  });

  return (
    <Card icon={Tag} title="Top categories" subtitle="By views + favourites on listings created in window">
      {isLoading ? (
        <EmptyRow text="Loading…" />
      ) : !data || data.length === 0 ? (
        <EmptyRow text="No activity yet." />
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((c) => (
            <li key={c.slug} className="flex items-center justify-between text-sm py-1">
              <Link to="/browse" search={{ category: c.slug }} className="text-navy hover:underline">
                {c.name}
              </Link>
              <span className="text-xs text-navy/60 shrink-0 ml-3">
                {c.listings} listings · {c.views} views · {c.favs} favs
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TopParishesCard({ sinceIso }: { sinceIso: string }) {
  const parishLabel = new Map(PARISHES.map((p) => [p.value, p.label]));
  const { data, isLoading } = useQuery({
    queryKey: ["insights-top-parishes", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("parish, views, favourite_count")
        .eq("status", "active")
        .gte("created_at", sinceIso)
        .limit(2000);
      if (error) throw error;
      const agg = new Map<string, { listings: number; views: number; favs: number }>();
      for (const l of data ?? []) {
        const cur = agg.get(l.parish) ?? { listings: 0, views: 0, favs: 0 };
        cur.listings += 1;
        cur.views += l.views ?? 0;
        cur.favs += l.favourite_count ?? 0;
        agg.set(l.parish, cur);
      }
      return Array.from(agg.entries())
        .map(([parish, v]) => ({ parish, ...v }))
        .sort((a, b) => b.listings - a.listings)
        .slice(0, 11);
    },
  });

  return (
    <Card icon={MapPin} title="Top parishes" subtitle="Where new listings are coming from">
      {isLoading ? (
        <EmptyRow text="Loading…" />
      ) : !data || data.length === 0 ? (
        <EmptyRow text="No listings yet." />
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map((p) => (
            <li key={p.parish} className="flex items-center justify-between text-sm py-1">
              <Link to="/browse" search={{ parish: p.parish }} className="text-navy hover:underline">
                {parishLabel.get(p.parish) ?? p.parish}
              </Link>
              <span className="text-xs text-navy/60 shrink-0 ml-3">
                {p.listings} listings · {p.views} views
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TrendingListingsCard({ sinceIso, className = "" }: { sinceIso: string; className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["insights-trending-listings", sinceIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, currency, parish, views, favourite_count, cover_image_url")
        .eq("status", "active")
        .gte("created_at", sinceIso)
        .limit(200);
      if (error) throw error;
      return (data ?? [])
        .map((l) => ({ ...l, score: (l.views ?? 0) + (l.favourite_count ?? 0) * 3 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    },
  });

  return (
    <Card icon={TrendingUp} title="Trending listings" subtitle="Score = views + 3× favourites" className={className}>
      {isLoading ? (
        <EmptyRow text="Loading…" />
      ) : !data || data.length === 0 ? (
        <EmptyRow text="No trending listings yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.map((l) => (
            <Link
              key={l.id}
              to="/listing/$id"
              params={{ id: l.id }}
              className="flex items-center gap-3 bg-sand rounded-xl p-2 hover:bg-sand-deep transition-colors"
            >
              <div className="size-12 rounded-lg overflow-hidden bg-sand-deep shrink-0">
                {l.cover_image_url && (
                  <img src={l.cover_image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.title}</div>
                <div className="text-xs text-navy/60 flex items-center gap-2">
                  <span>{formatPrice(l.price, l.currency)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" /> {l.views ?? 0}
                  </span>
                  <span>♥ {l.favourite_count ?? 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
