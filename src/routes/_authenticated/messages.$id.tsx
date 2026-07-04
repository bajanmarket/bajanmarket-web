import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { formatRelative } from "@/lib/format";
import { formatBBD } from "@/lib/format";
import { Send, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "Conversation — Bajan.market" }] }),
  component: Thread,
});

function Thread() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("conversations")
        .select(`id, buyer_id, seller_id, listing:listings(id, title, price, currency, cover_image_url, status)`)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [c.buyer_id, c.seller_id]);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return { ...c, buyer: byId.get(c.buyer_id) ?? null, seller: byId.get(c.seller_id) ?? null };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at, read_at")
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`msg-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["messages", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  // Mark incoming unread messages as read
  useEffect(() => {
    if (!user || !messages?.length) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== user.id && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["messages", id] });
      });
  }, [messages, user, id, qc]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body || !user) return;
      setText("");
      const { error } = await supabase.from("messages").insert({
        conversation_id: id, sender_id: user.id, body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", id] }),
  });

  const listing = conv?.listing as { id: string; title: string; price: number; currency: string; cover_image_url: string | null; status: string } | null;
  const other = user?.id === conv?.buyer_id ? conv?.seller : conv?.buyer;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <Link to="/messages" className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy">
          <ArrowLeft className="size-4" /> Back to inbox
        </Link>

        {listing && (
          <Link
            to="/listing/$id"
            params={{ id: listing.id }}
            className="flex items-center gap-3 bg-white rounded-2xl p-3 ring-1 ring-hairline"
          >
            <div className="size-12 rounded-xl overflow-hidden bg-sand-deep shrink-0">
              {listing.cover_image_url && <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{listing.title}</div>
              <div className="text-xs text-navy/60">{formatBBD(listing.price, listing.currency)} · with {(other as { display_name?: string })?.display_name}</div>
            </div>
          </Link>
        )}

        <div ref={scrollRef} className="bg-white rounded-3xl ring-1 ring-hairline p-4 h-[55vh] overflow-y-auto flex flex-col gap-2">
          {(() => {
            let lastReadMineIdx = -1;
            messages?.forEach((m, i) => {
              if (m.sender_id === user?.id && m.read_at) lastReadMineIdx = i;
            });
            return messages?.map((m, i) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-navy text-white rounded-br-md" : "bg-sand text-navy rounded-bl-md"}`}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-navy/40"}`}>{formatRelative(m.created_at)}</div>
                  </div>
                  {mine && i === lastReadMineIdx && (
                    <div className="text-[10px] text-navy/50 mt-0.5 pr-1">Read {formatRelative(m.read_at!)}</div>
                  )}
                  {mine && i === (messages?.length ?? 0) - 1 && !m.read_at && (
                    <div className="text-[10px] text-navy/40 mt-0.5 pr-1">Sent</div>
                  )}
                </div>
              );
            });
          })()}
          {messages?.length === 0 && (
            <div className="text-center text-navy/40 text-sm py-8">Say hello — sellers respond faster to polite messages.</div>
          )}
        </div>


        <form
          onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
          className="flex gap-2 bg-white rounded-2xl p-2 ring-1 ring-hairline"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || send.isPending}
            className="bg-coral text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 active:scale-95 transition-transform inline-flex items-center gap-1"
          >
            <Send className="size-4" /> Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
