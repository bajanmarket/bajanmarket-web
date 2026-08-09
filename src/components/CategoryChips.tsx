import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryChips({ selected }: { selected?: string }) {
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, icon")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-5 px-5">
      <button
        onClick={() => nav({ to: "/browse", search: {} })}
        className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium ${
          !selected ? "bg-navy text-white" : "bg-white ring-1 ring-hairline text-navy/60"
        }`}
      >
        All
      </button>
      {data?.map((c) => (
        <Link
          key={c.id}
          to="/browse"
          search={{ category: c.slug }}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-shadow ${
            selected === c.slug
              ? "bg-navy text-white"
              : "bg-white ring-1 ring-hairline text-navy/70 hover:ring-teal/40"
          }`}
        >
          <CategoryIcon name={c.icon} className="size-3.5" />
          {c.name}
        </Link>
      ))}
    </div>
  );
}

export function CategoryGrid() {
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, icon")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {data?.map((c) => (
        <Link
          key={c.id}
          to="/category/$slug"
          params={{ slug: c.slug }}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="size-14 rounded-2xl bg-white ring-1 ring-hairline grid place-items-center group-hover:ring-teal/40 transition-shadow">
            <CategoryIcon name={c.icon} className="size-6 text-teal" />
          </div>
          <span className="text-[11px] font-medium text-navy/70 text-center leading-tight">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}
