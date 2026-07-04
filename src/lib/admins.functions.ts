import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "moderator";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["admin", "moderator"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    // Fetch emails via admin API (paginated). For small teams this is fine.
    const emailMap = new Map<string, string>();
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error: e } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (e) throw new Error(e.message);
      for (const u of data.users) if (u.email) emailMap.set(u.id, u.email);
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 25) break; // safety cap ~5000 users
    }

    return (roles ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role as Role,
      created_at: r.created_at,
      display_name: profileMap.get(r.user_id) ?? null,
      email: emailMap.get(r.user_id) ?? null,
    }));
  });

export const grantRoleByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      email: z.string().email(),
      role: z.enum(["admin", "moderator"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const targetEmail = data.email.trim().toLowerCase();
    let found: { id: string; email: string } | null = null;
    let page = 1;
    const perPage = 200;
    while (!found) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => u.email?.toLowerCase() === targetEmail);
      if (match && match.email) {
        found = { id: match.id, email: match.email };
        break;
      }
      if (list.users.length < perPage) break;
      page += 1;
      if (page > 25) break;
    }
    if (!found) throw new Error(`No user found with email ${data.email}. They need to sign up first.`);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: found.id, role: data.role });
    if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);

    return { user_id: found.id, email: found.email, role: data.role };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "moderator"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role === "admin") {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
