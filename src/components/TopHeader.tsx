import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";
import { UserRound } from "lucide-react";

export function TopHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-sand/85 backdrop-blur-xl border-b border-hairline">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3.5">
        <Link to="/" className="text-lg font-semibold tracking-tight text-navy">
          Bajan<span className="text-teal">.market</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/browse"
            className="hidden sm:inline-flex text-sm font-medium text-navy/70 hover:text-navy px-3 py-2"
          >
            Browse
          </Link>
          {user && (
            <Link
              to="/bi"
              className="hidden sm:inline-flex text-sm font-medium text-navy/70 hover:text-navy px-3 py-2"
            >
              Business Intelligence
            </Link>
          )}
          {user ? (
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-hairline text-sm font-medium"
            >
              <span className="size-6 rounded-full bg-sand-deep grid place-items-center">
                <UserRound className="size-3.5 text-navy/60" />
              </span>
              <span className="hidden sm:inline">Account</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-navy text-white px-4 py-1.5 text-sm font-medium"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
