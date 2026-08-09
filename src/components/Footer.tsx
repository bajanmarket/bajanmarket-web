import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-white mt-12">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-sm text-navy/60">
          <span className="font-medium text-navy">BajanMarket</span> — Barbados' cleaner marketplace.
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-navy/60">
          <Link to="/browse" className="hover:text-teal">Browse</Link>
          <Link to="/services" className="hover:text-teal">Services</Link>
          <Link to="/businesses" className="hover:text-teal">Businesses</Link>
          <Link to="/terms" className="hover:text-teal">Terms</Link>
          <Link to="/privacy" className="hover:text-teal">Privacy</Link>
          <Link to="/community-guidelines" className="hover:text-teal">Community</Link>
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-5 pb-6 text-xs text-navy/40">
        © {new Date().getFullYear()} BajanMarket. All rights reserved.
      </div>
    </footer>
  );
}
