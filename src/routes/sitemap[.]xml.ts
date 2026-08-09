import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/site";
import { parishSlug } from "@/lib/parishes";

const BASE_URL = SITE_URL;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/browse", changefreq: "hourly", priority: "0.9" },
          { path: "/services", changefreq: "daily", priority: "0.8" },
          { path: "/businesses", changefreq: "daily", priority: "0.7" },
          { path: "/terms", changefreq: "monthly", priority: "0.3" },
          { path: "/privacy", changefreq: "monthly", priority: "0.3" },
          { path: "/community-guidelines", changefreq: "monthly", priority: "0.3" },
        ];

        // Published marketplace listings
        const { data: listings } = await supabase
          .from("listings")
          .select("id, updated_at, category_id, parish")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(20000);

        for (const l of listings ?? []) {
          entries.push({
            path: `/listing/${l.id}`,
            lastmod: l.updated_at ?? undefined,
            changefreq: "daily",
            priority: "0.7",
          });
        }

        // Category landing pages + parish pages that have real inventory
        const { data: categories } = await supabase
          .from("categories")
          .select("id, slug")
          .eq("active", true)
          .order("sort_order");

        const byCategory = new Map<string, Set<string>>();
        for (const l of listings ?? []) {
          if (!l.category_id || !l.parish) continue;
          if (!byCategory.has(l.category_id)) byCategory.set(l.category_id, new Set());
          byCategory.get(l.category_id)!.add(l.parish);
        }

        for (const c of categories ?? []) {
          entries.push({ path: `/category/${c.slug}`, changefreq: "daily", priority: "0.8" });
          for (const parish of byCategory.get(c.id) ?? []) {
            entries.push({
              path: `/category/${c.slug}/${parishSlug(parish)}`,
              changefreq: "daily",
              priority: "0.6",
            });
          }
        }

        // Public service listings
        const { data: services } = await supabase
          .from("service_listings")
          .select("id, updated_at")
          .eq("status", "active")
          .limit(5000);
        for (const s of services ?? []) {
          entries.push({
            path: `/services/${s.id}`,
            lastmod: s.updated_at ?? undefined,
            changefreq: "weekly",
            priority: "0.7",
          });
        }

        // Approved business storefronts
        const { data: businesses } = await supabase
          .from("businesses")
          .select("slug, updated_at")
          .eq("status", "approved")
          .limit(5000);
        for (const b of businesses ?? []) {
          entries.push({
            path: `/business/${b.slug}`,
            lastmod: b.updated_at ?? undefined,
            changefreq: "weekly",
            priority: "0.6",
          });
        }

        // Seller pages — only sellers that actually have public inventory
        const { data: activeSellers } = await supabase
          .from("listings")
          .select("seller_id")
          .eq("status", "active")
          .limit(20000);
        for (const id of new Set((activeSellers ?? []).map((r) => r.seller_id))) {
          entries.push({ path: `/seller/${id}`, changefreq: "weekly", priority: "0.5" });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
