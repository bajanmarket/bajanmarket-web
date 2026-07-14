// Compact trust-score chip used on seller/business pages.
// Fetches from public ci_trust_scores; returns null if none exists yet.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";

export function TrustBadge({ sellerId }: { sellerId: string }) {
  const { data } = useQuery({
    queryKey: ["trust-score", sellerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ci_trust_scores")
        .select("score")
        .eq("seller_id", sellerId)
        .maybeSingle();
      return data;
    },
  });
  if (!data) return null;
  const tone =
    data.score >= 80 ? "bg-teal/10 text-teal ring-teal/20" :
    data.score >= 50 ? "bg-sand ring-hairline text-navy" :
    "bg-coral/10 text-coral ring-coral/20";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-xs font-medium ${tone}`}>
      <ShieldCheck className="size-3" />
      Trust {data.score}
    </span>
  );
}
