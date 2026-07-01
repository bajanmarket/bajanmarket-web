import type { ReactNode } from "react";
import { TopHeader } from "./TopHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sand text-navy selection:bg-teal/15">
      <TopHeader />
      <main className="max-w-6xl mx-auto px-5 pt-6 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
