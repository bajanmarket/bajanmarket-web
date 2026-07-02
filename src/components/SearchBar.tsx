import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { PARISHES } from "@/lib/parishes";

export function SearchBar({ initialQuery = "", initialParish = "" }: { initialQuery?: string; initialParish?: string }) {
  const nav = useNavigate();
  const [q, setQ] = useState(initialQuery);
  const [parish, setParish] = useState(initialParish);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ to: "/browse", search: { q: q || undefined, parish: parish || undefined } });
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 p-2 bg-white rounded-3xl ring-1 ring-hairline shadow-sm">
      <div className="flex-1 flex items-center px-4 py-3 gap-3">
        <Search className="size-4 text-teal shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search anything…"
          className="w-full bg-transparent border-none outline-none text-navy placeholder:text-navy/40 text-sm"
        />
      </div>
      <div className="h-px sm:h-8 w-full sm:w-px bg-hairline sm:mx-1 self-stretch sm:self-center" />
      <select
        aria-label="Filter by parish"
        value={parish}
        onChange={(e) => setParish(e.target.value)}
        className="bg-transparent border-none outline-none text-sm font-medium px-4 py-3 text-navy/70"
      >
        <option value="">All Parishes</option>
        {PARISHES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <button className="bg-navy text-white text-sm font-medium px-6 py-3 rounded-2xl active:scale-95 transition-transform">
        Search
      </button>
    </form>
  );
}
