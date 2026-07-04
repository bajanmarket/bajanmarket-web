import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { unsubscribeByToken } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — Bajan.market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const unsub = useServerFn(unsubscribeByToken);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMsg("Missing unsubscribe token.");
      return;
    }
    setStatus("loading");
    unsub({ data: { token } })
      .then(() => {
        setStatus("done");
        setMsg("You've been unsubscribed from all Bajan.market marketing messages.");
      })
      .catch((e) => {
        setStatus("error");
        setMsg((e as Error).message);
      });
  }, [token, unsub]);

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-medium mb-3">Unsubscribe</h1>
        {status === "loading" && <p className="text-navy/60 text-sm">Processing…</p>}
        {status === "done" && <p className="text-teal text-sm">{msg}</p>}
        {status === "error" && <p className="text-terracotta text-sm">{msg}</p>}
        <p className="text-[11px] text-navy/40 mt-4">
          You can re-enable communications anytime from your profile.
        </p>
      </div>
    </main>
  );
}
