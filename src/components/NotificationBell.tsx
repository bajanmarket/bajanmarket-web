import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { formatRelative } from "@/lib/format";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * In-app notification centre. Shows booking and message activity only —
 * never private answers or contact details.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  if (!user) return null;

  const unread = (items ?? []).filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!unread) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const openItem = async (n: Row) => {
    setOpen(false);
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
    if (n.link) nav({ to: n.link });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative inline-flex items-center justify-center size-9 rounded-full bg-white ring-1 ring-hairline"
        >
          <Bell className="size-4 text-navy/70" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-coral text-white text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
          <span className="text-xs font-semibold uppercase tracking-wider text-navy/50">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-teal font-medium">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(items ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-navy/40">Nothing yet.</div>
          ) : (
            (items ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-hairline last:border-0 hover:bg-sand ${
                  n.read_at ? "" : "bg-teal/5"
                }`}
              >
                <div className="text-sm font-medium text-navy">{n.title}</div>
                {n.body && <div className="text-xs text-navy/60 mt-0.5 line-clamp-2">{n.body}</div>}
                <div className="text-[10px] text-navy/40 mt-1">{formatRelative(n.created_at)}</div>
              </button>
            ))
          )}
        </div>
        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="block text-center text-[11px] font-medium text-teal py-2.5 border-t border-hairline hover:bg-sand"
        >
          See all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
