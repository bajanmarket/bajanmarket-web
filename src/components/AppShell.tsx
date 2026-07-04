import type { ReactNode } from "react";
import { TopHeader } from "./TopHeader";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { useDeliveryReceipts } from "@/lib/useDeliveryReceipts";
import { useMessageNotifications } from "@/lib/useMessageNotifications";

export function AppShell({ children }: { children: ReactNode }) {
  useDeliveryReceipts();
  useMessageNotifications();
  return (
    <div className="min-h-screen bg-sand text-navy selection:bg-teal/15 flex flex-col">
      <TopHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto px-5 pt-6 pb-16">{children}</main>
      <Footer />
      <div className="pb-24" aria-hidden />
      <BottomNav />
    </div>
  );
}

