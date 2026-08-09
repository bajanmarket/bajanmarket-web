import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatRelative } from "@/lib/format";
import { Bell, Check, CheckCheck, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — BajanMarket" },
      { name: "description", content: "Every booking and message update on your BajanMarket account in one place." },
      { property: "og:title", content: "Notifications — BajanMarket" },
      { property: "og:description", content: "Track booking requests, confirmations, reminders and messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

const PAGE_SIZE = 20;

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [filter]);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page", user?.id, filter, page],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (filter === "unread") q = q.is("read_at", null);
      const { data: rows, count, error } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as Row[], count: count ?? 0 };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications-page"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const setRead = async (n: Row, read: boolean) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const markAllRead = async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) return toast.error(error.message);
    refresh();
    toast.success("All notifications marked as read");
  };

  const open = async (n: Row) => {
    if (!n.read_at) await setRead(n, true);
    if (n.link) nav({ to: n.link });
  };

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-teal" />
            <h1 className="text-2xl font-medium">Notifications</h1>
          </div>
          <button onClick={markAllRead} className="text-xs font-medium text-teal inline-flex items-center gap-1">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>

        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
          {([["all", "All"], ["unread", "Unread"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                filter === k ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-navy/40 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl ring-1 ring-hairline px-6 py-12 text-center">
            <p className="text-sm text-navy/50">
              {filter === "unread" ? "You're all caught up." : "No notifications yet."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl ring-1 ring-hairline overflow-hidden">
            {rows.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-hairline last:border-0 ${
                  n.read_at ? "" : "bg-teal/5"
                }`}
              >
                <button onClick={() => open(n)} className="flex-1 text-left">
                  <div className="text-sm font-medium text-navy">{n.title}</div>
                  {n.body && <div className="text-xs text-navy/60 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-navy/40 mt-1">{formatRelative(n.created_at)}</div>
                </button>
                <button
                  onClick={() => setRead(n, !n.read_at)}
                  aria-label={n.read_at ? "Mark as unread" : "Mark as read"}
                  className="shrink-0 mt-0.5 size-8 grid place-items-center rounded-full hover:bg-sand text-navy/50"
                >
                  {n.read_at ? <Undo2 className="size-3.5" /> : <Check className="size-4" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-xs font-medium px-3 py-2 rounded-lg ring-1 ring-hairline bg-white disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-navy/50">
              Page {page + 1} of {pages}
            </span>
            <button
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs font-medium px-3 py-2 rounded-lg ring-1 ring-hairline bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
