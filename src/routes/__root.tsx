import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { captureShareVisit } from "@/lib/shareVisit";
import { emitEvent } from "@/lib/ci/track";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand text-navy px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-hairline px-4 py-1.5 text-xs font-semibold tracking-wide text-navy/70">
          BAJAN.MARKET
        </div>
        <h1 className="text-6xl font-semibold text-coral">404</h1>
        <h2 className="mt-3 text-xl font-medium">This page took a swim.</h2>
        <p className="mt-2 text-sm text-navy/60">
          We can't find what you're looking for. It might've been sold, moved, or never existed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-coral px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
          >
            Back to marketplace
          </Link>
          <Link
            to="/browse"
            className="inline-flex items-center justify-center rounded-2xl border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-navy"
          >
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand text-navy px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-hairline px-4 py-1.5 text-xs font-semibold tracking-wide text-navy/70">
          BAJAN.MARKET
        </div>
        <h1 className="text-xl font-medium">Something didn't load</h1>
        <p className="mt-2 text-sm text-navy/60">
          There was a hiccup on our end. Try again, or head back to the marketplace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-2xl bg-coral px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-navy"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f9f7f4" },
      { title: "Bajan.market — Barbados' cleaner marketplace" },
      { name: "description", content: "Buy and sell across Barbados. Vehicles, property, electronics, furniture, jobs, road tennis and more — cleaner, safer, faster than the Facebook groups." },
      { property: "og:title", content: "Bajan.market — Barbados' cleaner marketplace" },
      { property: "og:description", content: "Buy and sell across Barbados. Vehicles, property, electronics, furniture, jobs, road tennis and more — cleaner, safer, faster than the Facebook groups." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Bajan.market" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bajan.market — Barbados' cleaner marketplace" },
      { name: "twitter:description", content: "Buy and sell across Barbados. Vehicles, property, electronics, furniture, jobs, road tennis and more — cleaner, safer, faster than the Facebook groups." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    captureShareVisit();
    emitEvent("PageViewed");
    return router.subscribe("onResolved", () => {
      captureShareVisit();
      emitEvent("PageViewed");
    });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
