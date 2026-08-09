import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string; client_id?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
};

function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 bg-sand text-navy">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-medium mb-2">Could not load this authorization request</h1>
        <p className="text-sm text-navy/70">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-sand text-navy">
      <div className="max-w-md w-full bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy/50 mb-1">BajanMarket</div>
          <h1 className="text-xl font-medium">Connect {clientName} to your account</h1>
        </div>
        <p className="text-sm text-navy/70">
          This lets {clientName} use BajanMarket as you — searching listings and accessing your own listings,
          favourites, and messages. Your existing app permissions still apply.
        </p>
        {details?.scope ? (
          <div className="text-xs text-navy/50 bg-sand/60 rounded-xl p-3">
            Requested scope: <span className="font-mono">{details.scope}</span>
          </div>
        ) : null}
        {error && (
          <p role="alert" className="text-sm text-coral">{error}</p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 bg-white ring-1 ring-hairline rounded-2xl py-3 text-sm font-medium text-navy/70 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-navy text-white rounded-2xl py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}
