import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingBag, Eye, MessageSquare, Heart, Search as SearchIcon, Share2 } from "lucide-react";

export function AnalyticsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const monthStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

      const [
        totalUsers, newUsersToday, newUsersWeek, activeUsers,
        totalListings, newListingsToday,
        favouritesCount, messagesCount, searchesCount, sharesCount,
        topViewed, catRollup,
        userGrowth, listingGrowth,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekStart.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("last_active_at", weekStart.toISOString()),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("favourites").select("listing_id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("search_events").select("id", { count: "exact", head: true }),
        supabase.from("share_visits").select("id", { count: "exact", head: true }),
        supabase.from("listings").select("id, title, views, cover_image_url").eq("status", "active").order("views", { ascending: false }).limit(8),
        supabase.from("listings").select("category_id, categories(name)").eq("status", "active"),
        supabase.from("profiles").select("created_at").gte("created_at", monthStart.toISOString()),
        supabase.from("listings").select("created_at").gte("created_at", monthStart.toISOString()),
      ]);

      // Bucket by day
      const bucketDays = (rows: { created_at: string }[] | null) => {
        const map = new Map<string, number>();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
          map.set(d.toISOString().slice(0, 10), 0);
        }
        for (const r of rows ?? []) {
          const k = r.created_at.slice(0, 10);
          if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
        }
        return Array.from(map.entries()).map(([day, n]) => ({ day, n }));
      };

      const catCounts = new Map<string, number>();
      for (const l of (catRollup.data ?? []) as { categories: { name: string } | null }[]) {
        const name = l.categories?.name ?? "Uncategorised";
        catCounts.set(name, (catCounts.get(name) ?? 0) + 1);
      }
      const byCategory = Array.from(catCounts.entries()).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 8);

      return {
        totalUsers: totalUsers.count ?? 0,
        newUsersToday: newUsersToday.count ?? 0,
        newUsersWeek: newUsersWeek.count ?? 0,
        activeUsers: activeUsers.count ?? 0,
        totalListings: totalListings.count ?? 0,
        newListingsToday: newListingsToday.count ?? 0,
        favouritesCount: favouritesCount.count ?? 0,
        messagesCount: messagesCount.count ?? 0,
        searchesCount: searchesCount.count ?? 0,
        sharesCount: sharesCount.count ?? 0,
        topViewed: topViewed.data ?? [],
        byCategory,
        userGrowth: bucketDays(userGrowth.data as { created_at: string }[]),
        listingGrowth: bucketDays(listingGrowth.data as { created_at: string }[]),
      };
    },
  });

  if (isLoading || !data) return <div className="text-navy/40 text-sm">Loading analytics…</div>;

  return (
    <div className="flex flex-col gap-6">
      <Section title="Users">
        <StatGrid>
          <Stat icon={<Users className="size-4" />} label="Total users" value={data.totalUsers} />
          <Stat label="New today" value={data.newUsersToday} />
          <Stat label="New this week" value={data.newUsersWeek} />
          <Stat label="Active (7d)" value={data.activeUsers} />
        </StatGrid>
      </Section>

      <Section title="Marketplace">
        <StatGrid>
          <Stat icon={<ShoppingBag className="size-4" />} label="Total listings" value={data.totalListings} />
          <Stat label="New today" value={data.newListingsToday} />
        </StatGrid>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Card title="Listings by category">
            {data.byCategory.length === 0 ? <Empty /> : (
              <ul className="text-sm space-y-1.5">
                {data.byCategory.map((c) => (
                  <li key={c.name} className="flex justify-between">
                    <span className="text-navy/70">{c.name}</span>
                    <span className="font-medium">{c.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Most viewed listings">
            {data.topViewed.length === 0 ? <Empty /> : (
              <ul className="text-sm space-y-2">
                {data.topViewed.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <div className="size-8 rounded bg-sand-deep overflow-hidden shrink-0">
                      {l.cover_image_url && <img src={l.cover_image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="flex-1 truncate">{l.title}</span>
                    <span className="text-navy/60 text-xs">{l.views ?? 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      <Section title="Engagement">
        <StatGrid>
          <Stat icon={<MessageSquare className="size-4" />} label="Messages" value={data.messagesCount} />
          <Stat icon={<Heart className="size-4" />} label="Saved" value={data.favouritesCount} />
          <Stat icon={<SearchIcon className="size-4" />} label="Searches" value={data.searchesCount} />
          <Stat icon={<Share2 className="size-4" />} label="Share visits" value={data.sharesCount} />
        </StatGrid>
      </Section>

      <Section title="Growth (last 30 days)">
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="New users / day"><Sparkline points={data.userGrowth} color="#2C948B" /></Card>
          <Card title="New listings / day"><Sparkline points={data.listingGrowth} color="#EC5F4E" /></Card>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-navy/50 mb-2">{title}</div>
      {children}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <div className="flex items-center gap-1.5 text-xs text-navy/60">{icon}{label}</div>
      <div className="text-2xl font-medium mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-navy/50 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Empty() { return <div className="text-navy/40 text-sm">No data yet.</div>; }

function Sparkline({ points, color }: { points: { day: string; n: number }[]; color: string }) {
  const w = 320, h = 80, p = 4;
  const max = Math.max(1, ...points.map((p) => p.n));
  const step = (w - p * 2) / Math.max(1, points.length - 1);
  const path = points.map((pt, i) => {
    const x = p + i * step;
    const y = h - p - (pt.n / max) * (h - p * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const total = points.reduce((s, pt) => s + pt.n, 0);
  return (
    <div>
      <div className="text-xl font-medium">{total.toLocaleString()}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 mt-1" preserveAspectRatio="none">
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
