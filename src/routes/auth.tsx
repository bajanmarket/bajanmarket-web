import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Bajan.market" },
      { name: "description", content: "Sign in or create your Bajan.market account to post listings, save favourites and message sellers." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : "/";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: safeRedirect });
    });
  }, [nav, safeRedirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Welcome to Bajan.market!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: safeRedirect });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(result.error.message);
    if (result.redirected) return;
    nav({ to: safeRedirect });
  };

  return (
    <div className="min-h-screen bg-sand grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-semibold text-navy tracking-tight">
            Bajan<span className="text-teal">.market</span>
          </Link>
          <p className="text-navy/60 text-sm mt-2">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
        </div>

        <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
          <button
            onClick={google}
            className="w-full bg-white ring-1 ring-hairline rounded-2xl py-3 text-sm font-medium text-navy hover:bg-sand transition-colors"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-[11px] text-navy/40 uppercase tracking-wider">
            <div className="flex-1 h-px bg-hairline" /> or <div className="flex-1 h-px bg-hairline" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <Field label="Your name">
                <input
                  required minLength={2} maxLength={80}
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
                  placeholder="e.g. Adrian S."
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
              />
            </Field>
            <Field label="Password">
              <input
                required type="password" minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
              />
            </Field>
            <button
              disabled={loading}
              className="mt-2 bg-navy text-white rounded-2xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-xs text-navy/60 hover:text-navy"
          >
            {mode === "signin" ? "New to Bajan.market? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="text-[11px] text-navy/40 text-center mt-6 max-w-xs mx-auto">
          By continuing you agree to trade respectfully with fellow Bajans and to keep the marketplace clean.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">{label}</span>
      {children}
    </label>
  );
}
