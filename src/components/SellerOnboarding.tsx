import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, PenLine, Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

const DISMISS_KEY = "bm.onboarding.seller.dismissed";

/**
 * Lightweight first-time seller onboarding.
 * Shown only when: signed-in, has 0 listings, hasn't dismissed.
 *
 * `variant="banner"` — compact home-page card with CTA to /post.
 * `variant="steps"` — inline checklist for the /post page.
 */
export function SellerOnboarding({ variant = "banner" }: { variant?: "banner" | "steps" }) {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const { data: count, isLoading } = useQuery({
    queryKey: ["seller-onboarding", "count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (loading || !user || isLoading) return null;
  if ((count ?? 0) > 0) return null;
  if (variant === "banner" && dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (variant === "steps") {
    return (
      <div className="bg-teal/5 border border-teal/20 rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-teal" />
          <h3 className="text-sm font-semibold text-navy">Your first listing — a quick guide</h3>
        </div>
        <ol className="grid sm:grid-cols-3 gap-3">
          <Step n={1} icon={<Camera className="size-4" />} title="Clear photos" body="3-5 shots in daylight. Show any wear honestly." />
          <Step n={2} icon={<PenLine className="size-4" />} title="Honest details" body="Condition, why you're selling, and a fair BBD price." />
          <Step n={3} icon={<Send className="size-4" />} title="Reply fast" body="Buyers move on quickly — respond within a few hours." />
        </ol>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-teal/10 via-white to-coral/5 border border-teal/20 rounded-3xl p-5 sm:p-6">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 size-7 grid place-items-center rounded-full text-navy/50 hover:bg-white/70"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal">
        <Sparkles className="size-3.5" /> New seller
      </div>
      <h3 className="mt-2 text-lg sm:text-xl font-medium text-navy">Post your first listing in under a minute.</h3>
      <p className="mt-1 text-sm text-navy/60 max-w-md">
        A few clear photos, an honest description, and a fair BBD price — that's it. The island will find it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to="/post"
          className="inline-flex items-center rounded-2xl bg-coral text-white px-4 py-2 text-sm font-medium active:scale-95 transition-transform"
        >
          Start posting
        </Link>
        <button
          onClick={dismiss}
          className="text-sm font-medium text-navy/60 hover:text-navy px-2 py-2"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3 bg-white/70 rounded-xl p-3 ring-1 ring-hairline">
      <div className="size-8 rounded-lg bg-teal/10 text-teal grid place-items-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold text-navy/50">Step {n}</div>
        <div className="text-sm font-medium text-navy">{title}</div>
        <div className="text-xs text-navy/60 mt-0.5">{body}</div>
      </div>
    </li>
  );
}
