import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { listAdmins, grantRoleByEmail, revokeRole } from "@/lib/admins.functions";
import { useAuth } from "@/lib/useAuth";
import { formatRelative } from "@/lib/format";

export function AdminsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAdmins);
  const grantFn = useServerFn(grantRoleByEmail);
  const revokeFn = useServerFn(revokeRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "moderator">("admin");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admins-list"],
    queryFn: () => listFn({}),
  });

  const grant = useMutation({
    mutationFn: (v: { email: string; role: "admin" | "moderator" }) =>
      grantFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Granted ${r.role} to ${r.email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admins-list"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revoke = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "moderator" }) =>
      revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["admins-list"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="size-4 text-teal" />
          <h2 className="text-sm font-semibold">Grant a role</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            grant.mutate({ email: email.trim(), role });
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 text-sm rounded-lg ring-1 ring-hairline px-3 py-2 focus:outline-none focus:ring-navy/30"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "moderator")}
            className="text-sm rounded-lg ring-1 ring-hairline px-3 py-2 bg-white"
          >
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
          <button
            type="submit"
            disabled={grant.isPending}
            className="text-sm bg-navy text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {grant.isPending ? "Adding…" : "Add"}
          </button>
        </form>
        <p className="text-xs text-navy/50 mt-2">
          The user must have signed up first. Grants take effect immediately.
        </p>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-teal" />
          <h2 className="text-sm font-semibold">Current admins & moderators</h2>
        </div>
        {isLoading ? (
          <div className="text-navy/40 text-sm">Loading…</div>
        ) : error ? (
          <div className="text-coral text-sm">{(error as Error).message}</div>
        ) : data && data.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {data.map((r) => (
              <li key={`${r.user_id}-${r.role}`} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.display_name ?? "—"}
                  </div>
                  <div className="text-xs text-navy/50 truncate">
                    {r.email ?? r.user_id} · added {formatRelative(r.created_at)}
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase bg-sand rounded-full px-2 py-1">
                  {r.role}
                </span>
                <button
                  disabled={revoke.isPending || (r.user_id === user?.id && r.role === "admin")}
                  onClick={() => {
                    if (r.user_id === user?.id && r.role === "admin") return;
                    if (confirm(`Remove ${r.role} from ${r.email ?? r.display_name ?? "this user"}?`)) {
                      revoke.mutate({ user_id: r.user_id, role: r.role });
                    }
                  }}
                  className="text-xs text-coral hover:bg-coral/10 rounded-lg px-2 py-1 inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={r.user_id === user?.id && r.role === "admin" ? "You can't remove your own admin role" : "Remove role"}
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-navy/50 text-sm">No admins or moderators yet.</div>
        )}
      </div>
    </div>
  );
}
