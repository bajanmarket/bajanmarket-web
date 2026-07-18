import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
      { property: "og:title", content: "Sign in — Bajan.market" },
      { property: "og:url", content: "https://bajanmarketplacetest.lovable.app/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://bajanmarketplacetest.lovable.app/auth" }],
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
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordValid = passwordChecks.length && passwordChecks.letter && passwordChecks.number;

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
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}${safeRedirect}`,
          },
        });
        if (error) throw error;
        if (data.user && marketingOptIn) {
          await supabase.from("marketing_preferences").upsert({
            user_id: data.user.id,
            email_opt_in: true,
            consented_at: new Date().toISOString(),
          });
        }
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
        toast.success("Welcome to Bajan.market!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: safeRedirect });
    } catch (err) {
      const msg = (err as Error).message || "Something went wrong";
      const lower = msg.toLowerCase();
      if (lower.includes("weak") || lower.includes("pwned") || lower.includes("compromis")) {
        toast.error(
          "That password has appeared in a known data breach. Please choose a different, unique password (try adding extra words, numbers, or symbols).",
          { duration: 8000 }
        );
      } else {
        toast.error(msg);
      }
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
          <h1 className="text-navy/60 text-sm mt-2 font-normal">
            {mode === "signup" ? "Create your Bajan.market account" : "Welcome back to Bajan.market"}
          </h1>
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
              <Field label="Your name" htmlFor="auth-name">
                <input
                  id="auth-name"
                  required minLength={2} maxLength={80}
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
                  placeholder="e.g. Adrian S."
                />
              </Field>
            )}
            <Field label="Email" htmlFor="auth-email">
              <input
                id="auth-email"
                required type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
              />
            </Field>
            <Field label="Password" htmlFor="auth-password">
              <div className="relative">
                <input
                  id="auth-password"
                  required type={showPassword ? "text" : "password"} minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-sand rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-teal"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-navy/50 hover:text-navy"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <ul className="mt-1.5 text-[11px] text-navy/60 space-y-0.5">
                  <li className={passwordChecks.length ? "text-teal" : ""}>
                    {passwordChecks.length ? "✓" : "○"} At least 8 characters
                  </li>
                  <li className={passwordChecks.letter ? "text-teal" : ""}>
                    {passwordChecks.letter ? "✓" : "○"} Contains a letter
                  </li>
                  <li className={passwordChecks.number ? "text-teal" : ""}>
                    {passwordChecks.number ? "✓" : "○"} Contains a number
                  </li>
                  <li className="text-navy/50">
                    Avoid common passwords (like "password123") — they're blocked for your safety.
                  </li>
                </ul>
              )}
            </Field>
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-navy/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 size-4 accent-teal"
                />
                <span>Send me occasional tips, updates, and offers from Bajan.market. You can unsubscribe anytime.</span>
              </label>
            )}
            <button
              disabled={loading || (mode === "signup" && !passwordValid)}
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

        <p className="text-[11px] text-navy/40 text-center mt-6 max-w-xs mx-auto leading-relaxed">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline hover:text-navy">Terms</Link>,{" "}
          <Link to="/privacy" className="underline hover:text-navy">Privacy Policy</Link>{" "}
          and{" "}
          <Link to="/community-guidelines" className="underline hover:text-navy">Community Guidelines</Link>.
        </p>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-wider text-navy/50">{label}</label>
      {children}
    </div>
  );
}
