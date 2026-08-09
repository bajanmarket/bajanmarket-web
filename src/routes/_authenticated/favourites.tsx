import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/favourites")({
  head: () => ({ meta: [{ title: "Saved listings — BajanMarket" }] }),
  component: Favs,
});

function Favs() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["favourites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favourites")
        .select("listing:listings(id, title, price, currency, parish, condition, cover_image_url, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.listing).filter(Boolean) as unknown as ListingCardData[];
    },
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-medium mb-4">Saved</h1>
      {isLoading ? null : data && data.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <div className="mx-auto size-14 rounded-full bg-coral/10 grid place-items-center text-coral mb-3">
            <Heart className="size-6" />
          </div>
          <h3 className="text-lg font-medium">Nothing saved yet.</h3>
          <p className="text-sm text-navy/60 mt-2 mb-4">Tap the heart on any listing to keep it here for later.</p>
          <Link to="/browse" className="inline-flex rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium">
            Start browsing
          </Link>
        </div>
      )}
    </AppShell>
  );
}
