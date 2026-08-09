import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ServiceCard, type ServiceCardData } from "@/components/ServiceCard";
import { PARISHES } from "@/lib/parishes";
import { CalendarCheck } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  parish: z.string().optional(),
  max: z.coerce.number().optional(),
  rating: z.coerce.number().optional(),
  available: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/services/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Book local services in Barbados — BajanMarket" },
      {
        name: "description",
        content:
          "Book spa, massage, cleaning, lawn care, tutoring, pet care, childcare and tech support appointments with trusted Barbadian providers.",
      },
      { property: "og:title", content: "Book local services in Barbados — BajanMarket" },
      {
        property: "og:description",
        content: "Find a local service provider, pick a time that suits you, and book it in a few taps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServicesBrowse,
});

function ServicesBrowse() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();

  const { data: categories } = useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_categories")
        .select("id, slug, name")
        .eq("active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["services-browse", search],
    queryFn: async () => {
      let categoryId: string | undefined;
      if (search.category) {
        const { data: cat } = await supabase
          .from("service_categories")
          .select("id")
          .eq("slug", search.category)
          .maybeSingle();
        categoryId = cat?.id;
      }
      let q = supabase
        .from("service_listings")
        .select(
          "id, title, price, currency, price_unit, duration_minutes, parish, cover_image_url, mobile_service, rating_avg, rating_count, provider_id",
        )
        .eq("status", "active");
      if (categoryId) q = q.eq("category_id", categoryId);
      if (search.parish) q = q.eq("parish", search.parish as never);
      if (search.max != null) q = q.lte("price", search.max);
      if (search.rating != null) q = q.gte("rating_avg", search.rating);
      if (search.q) q = q.ilike("title", `%${search.q}%`);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      let rows = (data ?? []) as (ServiceCardData & { provider_id: string })[];

      if (search.available) {
        const ids = Array.from(new Set(rows.map((r) => r.provider_id)));
        if (ids.length) {
          const { data: av } = await supabase.rpc("providers_with_availability", {
            _provider_ids: ids,
          });
          const withAvail = new Set((av ?? []).map((a) => a.provider_id));
          rows = rows.filter((r) => withAvail.has(r.provider_id));
        }
      }
      return rows;
    },
  });

  const chip = (active: boolean) =>
    `px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[40px] inline-flex items-center ${
      active ? "bg-navy text-white" : "bg-white ring-1 ring-hairline text-navy/70"
    }`;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-medium text-navy">Book a service in Barbados</h1>
          <p className="text-sm text-navy/60 mt-1">
            Pick a provider, choose an appointment time and book it — no back-and-forth needed.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            nav({ to: "/services", search: { ...search, q: String(fd.get("q") || "") || undefined } });
          }}
          className="flex gap-2"
        >
          <input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Search services…"
            className="flex-1 bg-white ring-1 ring-hairline rounded-2xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal min-h-[48px]"
          />
          <button className="bg-navy text-white rounded-2xl px-5 text-sm font-medium min-h-[48px]">Search</button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
          <button
            onClick={() => nav({ to: "/services", search: { ...search, category: undefined } })}
            className={chip(!search.category)}
          >
            All
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => nav({ to: "/services", search: { ...search, category: c.slug } })}
              className={chip(search.category === c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by parish"
            value={search.parish ?? ""}
            onChange={(e) => nav({ to: "/services", search: { ...search, parish: e.target.value || undefined } })}
            className="bg-white ring-1 ring-hairline rounded-full px-4 py-2 text-xs font-medium text-navy/70 min-h-[40px]"
          >
            <option value="">All parishes</option>
            {PARISHES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Maximum price"
            value={search.max ?? ""}
            onChange={(e) =>
              nav({ to: "/services", search: { ...search, max: e.target.value ? Number(e.target.value) : undefined } })
            }
            className="bg-white ring-1 ring-hairline rounded-full px-4 py-2 text-xs font-medium text-navy/70 min-h-[40px]"
          >
            <option value="">Any price</option>
            {[50, 100, 200, 400].map((v) => (
              <option key={v} value={v}>
                Up to ${v}
              </option>
            ))}
          </select>
          <select
            aria-label="Minimum rating"
            value={search.rating ?? ""}
            onChange={(e) =>
              nav({
                to: "/services",
                search: { ...search, rating: e.target.value ? Number(e.target.value) : undefined },
              })
            }
            className="bg-white ring-1 ring-hairline rounded-full px-4 py-2 text-xs font-medium text-navy/70 min-h-[40px]"
          >
            <option value="">Any rating</option>
            <option value="3">3+ stars</option>
            <option value="4">4+ stars</option>
          </select>
          <button
            onClick={() => nav({ to: "/services", search: { ...search, available: search.available ? undefined : true } })}
            className={chip(Boolean(search.available))}
          >
            Has availability
          </button>
        </div>

        {isLoading ? (
          <div className="text-navy/40 text-sm">Loading services…</div>
        ) : services && services.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
            <CalendarCheck className="size-8 mx-auto text-navy/30" />
            <h2 className="text-lg font-medium mt-3">No services here yet.</h2>
            <p className="text-sm text-navy/60 mt-2">
              Offer a service in Barbados?{" "}
              <Link to="/provider-services" className="text-teal font-medium underline">
                List it and take bookings
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
