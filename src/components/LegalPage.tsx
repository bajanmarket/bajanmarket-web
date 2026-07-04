import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-wider text-navy/40 mb-2">Legal</div>
      <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-navy mb-2">{title}</h1>
      <p className="text-sm text-navy/50 mb-8">Last updated {updated}</p>
      <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 sm:p-8 prose-legal text-navy/80 text-[15px] leading-relaxed flex flex-col gap-5">
        {children}
      </div>
      <div className="mt-8 flex flex-wrap gap-4 text-sm text-navy/60">
        <Link to="/terms" className="hover:text-teal">Terms</Link>
        <Link to="/privacy" className="hover:text-teal">Privacy</Link>
        <Link to="/community-guidelines" className="hover:text-teal">Community guidelines</Link>
      </div>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-navy mt-2">{children}</h2>;
}
