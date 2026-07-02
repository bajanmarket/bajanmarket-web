import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://bajanmarketplacetest.lovable.app";

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
        ];

        const { data: listings } = await supabase
          .from("listings")
          .select("id, updated_at")
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(5000);
        for (const l of listings ?? []) {
          entries.push({ path: `/listing/${l.id}`, lastmod: l.updated_at ?? undefined, changefreq: "daily", priority: "0.7" });
        }

        const { data: sellers } = await supabase
          .from("profiles")
          .select("id, updated_at")
          .limit(5000);
        for (const s of sellers ?? []) {
          entries.push({ path: `/seller/${s.id}`, lastmod: s.updated_at ?? undefined, changefreq: "weekly", priority: "0.5" });
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
