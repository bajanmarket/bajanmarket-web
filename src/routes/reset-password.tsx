import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — BajanMarket" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const checks = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /\d/.test(password),
  };
  const valid = checks.length && checks.letter && checks.number;

  useEffect(() => {
    // Supabase JS auto-processes the recovery link and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // Also check if a session already exists (link already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      nav({ to: "/" });
    } catch (err) {
      const msg = (err as Error).message || "Could not update password";
      const lower = msg.toLowerCase();
      if (lower.includes("weak") || lower.includes("pwned") || lower.includes("compromis")) {
        toast.error("That password has appeared in a data breach. Please choose a different, unique password.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-semibold text-navy tracking-tight">
            Bajan<span className="text-teal">.market</span>
          </Link>
          <h1 className="text-navy/60 text-sm mt-2 font-normal">Set a new password</h1>
        </div>

        <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
          {!ready ? (
            <div className="text-sm text-navy/70 leading-relaxed">
              Verifying your reset link… If nothing happens, request a new link from the{" "}
              <Link to="/auth" className="underline text-navy">sign in page</Link>.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-[11px] font-medium uppercase tracking-wider text-navy/50">New password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    required type={showPassword ? "text" : "password"} minLength={8}
                    autoComplete="new-password"
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
                <ul className="mt-1.5 text-[11px] text-navy/60 space-y-0.5">
                  <li className={checks.length ? "text-teal" : ""}>{checks.length ? "✓" : "○"} At least 8 characters</li>
                  <li className={checks.letter ? "text-teal" : ""}>{checks.letter ? "✓" : "○"} Contains a letter</li>
                  <li className={checks.number ? "text-teal" : ""}>{checks.number ? "✓" : "○"} Contains a number</li>
                </ul>
              </div>
              <button
                disabled={loading || !valid}
                className="mt-2 bg-navy text-white rounded-2xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
