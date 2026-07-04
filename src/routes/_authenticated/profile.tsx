import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { uploadImage } from "@/lib/uploadImage";
import { PARISHES } from "@/lib/parishes";
import { initials } from "@/lib/format";
import { LogOut, Settings, Package, Heart, Shield } from "lucide-react";
import { useIsModerator } from "@/lib/useIsModerator";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My account — Bajan.market" }] }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: privateProfile } = useQuery({
    queryKey: ["profile_private", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_private")
        .select("phone")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") || "") || null;
    const { error } = await supabase.from("profiles").update({
      display_name: String(fd.get("display_name") || "").trim(),
      bio: String(fd.get("bio") || ""),
      parish: (fd.get("parish") || null) as never,
    }).eq("id", user.id);
    const { error: pErr } = await supabase.from("profile_private").upsert({
      user_id: user.id,
      phone,
    });
    setSaving(false);
    if (error || pErr) { toast.error((error ?? pErr)!.message); return; }
    toast.success("Profile updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    qc.invalidateQueries({ queryKey: ["profile_private", user.id] });
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file || !user) return;
    try {
      const url = await uploadImage("avatars", user.id, file);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Avatar updated");
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (!window.confirm("Delete your account? Your listings and messages will be removed.")) return;
    // Trigger user deletion by removing profile (cascades) + signout. True account
    // deletion happens server-side; for now we clear all data owned by the user.
    await supabase.from("listings").delete().eq("seller_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  };

  if (!profile) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex items-center gap-4">
          <label className="relative size-16 rounded-full overflow-hidden bg-sand-deep grid place-items-center text-lg font-semibold text-navy/60 cursor-pointer">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : initials(profile.display_name)}
            <input type="file" accept="image/*" hidden onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-medium truncate">{profile.display_name}</div>
            <div className="text-xs text-navy/50 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-full bg-sand ring-1 ring-hairline p-2"
            aria-label="Edit profile"
          >
            <Settings className="size-4" />
          </button>
        </div>

        {editing && (
          <form onSubmit={save} className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
            <F label="Display name">
              <input name="display_name" defaultValue={profile.display_name} required maxLength={80} className={inp} />
            </F>
            <F label="Bio">
              <textarea name="bio" rows={3} maxLength={500} defaultValue={profile.bio ?? ""} className={inp} />
            </F>
            <F label="Phone">
              <input name="phone" type="tel" defaultValue={privateProfile?.phone ?? ""} className={inp} placeholder="+1 246 …" />
            </F>
            <F label="Parish">
              <select name="parish" defaultValue={profile.parish ?? ""} className={inp}>
                <option value="">Prefer not to say</option>
                {PARISHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </F>
            <button disabled={saving} className="bg-navy text-white rounded-2xl py-3 text-sm font-medium">
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link to="/my-listings" className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center gap-3">
            <Package className="size-5 text-teal" />
            <span className="font-medium text-sm">My listings</span>
          </Link>
          <Link to="/favourites" className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center gap-3">
            <Heart className="size-5 text-coral" />
            <span className="font-medium text-sm">Saved</span>
          </Link>
        </div>

        <ModeratorLink />


        <div className="flex flex-col gap-2">
          <button
            onClick={signOut}
            className="bg-white ring-1 ring-hairline rounded-2xl py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <LogOut className="size-4" /> Sign out
          </button>
          <button
            onClick={deleteAccount}
            className="text-xs text-navy/40 hover:text-destructive py-2"
          >
            Delete my account
          </button>
        </div>
      </div>
    </AppShell>
  );
}

const inp = "w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">{label}</span>
      {children}
    </label>
  );
}

function ModeratorLink() {
  const { data } = useIsModerator();
  if (!data?.isModerator) return null;
  return (
    <Link
      to="/admin"
      className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center gap-3"
    >
      <Shield className="size-5 text-navy" />
      <span className="font-medium text-sm">Moderation panel</span>
    </Link>
  );
}

