import type { ReactNode } from "react";
import { TopHeader } from "./TopHeader";
import { BottomNav } from "./BottomNav";
import { useDeliveryReceipts } from "@/lib/useDeliveryReceipts";
import { useMessageNotifications } from "@/lib/useMessageNotifications";

export function AppShell({ children }: { children: ReactNode }) {
  useDeliveryReceipts();
  useMessageNotifications();
  return (
    <div className="min-h-screen bg-sand text-navy selection:bg-teal/15">
      <TopHeader />
      <main className="max-w-6xl mx-auto px-5 pt-6 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
