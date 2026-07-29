import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, CalendarCheck, UserRound } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/browse", label: "Browse", icon: Search },
] as const;

const rightItems = [
  { to: "/services", label: "Services", icon: CalendarCheck },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const linkCls = (active: boolean) =>
    `flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors ${
      active ? "text-navy" : "text-navy/40"
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-hairline bg-white/90 backdrop-blur-xl">
      <div className="max-w-md mx-auto flex items-center justify-between px-5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={linkCls(pathname === it.to)}>
            <it.icon className="size-5" strokeWidth={2} />
            <span className="text-[10px] font-medium">{it.label}</span>
          </Link>
        ))}
        <Link
          to="/post"
          className="-mt-8 size-14 rounded-full bg-coral text-white shadow-lg shadow-coral/25 ring-4 ring-sand grid place-items-center active:scale-95 transition-transform"
          aria-label="Post a listing"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </Link>
        {rightItems.map((it) => (
          <Link key={it.to} to={it.to} className={linkCls(pathname.startsWith(it.to))}>
            <it.icon className="size-5" strokeWidth={2} />
            <span className="text-[10px] font-medium">{it.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
