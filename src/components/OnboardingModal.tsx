import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";

type Intent = "buyer" | "seller" | "both";

/**
 * One-time onboarding survey. Renders as a modal when profile.onboarded_at is null.
 * Skippable — skipping still stamps onboarded_at so we don't re-prompt.
 */
export function OnboardingModal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const { data: profile } = useQuery({
    queryKey: ["profile_onboarding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, onboarded_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories_onboarding"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("slug, name").eq("active", true).order("sort_order");
      return data ?? [];
    },
  });

  if (!user || !profile || profile.onboarded_at) return null;

  const toggle = (slug: string) => {
    setPicked((p) => p.includes(slug) ? p.filter((s) => s !== slug) : p.length >= 3 ? p : [...p, slug]);
  };

  const finish = async (skip = false) => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      onboarding_intent: skip ? null : intent,
      onboarding_categories: skip ? null : picked,
      onboarded_at: new Date().toISOString(),
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile_onboarding", user.id] });
    if (!skip) toast.success("Thanks! We'll tailor things for you.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 flex flex-col gap-5 relative">
        <button
          onClick={() => finish(true)}
          className="absolute top-4 right-4 text-navy/40 hover:text-navy"
          aria-label="Skip"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-teal" />
          <h2 className="text-lg font-medium">Welcome — quick question</h2>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy/50 mb-2">What brings you here?</div>
          <div className="grid grid-cols-3 gap-2">
            {(["buyer", "seller", "both"] as Intent[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setIntent(v)}
                className={`rounded-2xl py-3 text-sm font-medium ring-1 transition-colors capitalize ${
                  intent === v ? "bg-navy text-white ring-navy" : "bg-sand text-navy ring-hairline hover:ring-navy/20"
                }`}
              >
                {v === "both" ? "Both" : v === "buyer" ? "Buying" : "Selling"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy/50 mb-2">
            Pick up to 3 categories you care about
          </div>
          <div className="flex flex-wrap gap-2">
            {(categories ?? []).map((c) => {
              const on = picked.includes(c.slug);
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => toggle(c.slug)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                    on ? "bg-teal text-white ring-teal" : "bg-sand text-navy ring-hairline hover:ring-teal/40"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => finish(true)}
            className="flex-1 bg-white ring-1 ring-hairline rounded-2xl py-3 text-sm font-medium text-navy/70"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={saving || !intent}
            onClick={() => finish(false)}
            className="flex-1 bg-navy text-white rounded-2xl py-3 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
