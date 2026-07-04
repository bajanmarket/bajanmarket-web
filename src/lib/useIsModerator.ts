import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

/**
 * Returns whether the current user is a moderator or admin.
 * Uses user_roles + has_role (via a client select on user_roles which is
 * scoped to auth.uid() by the "users see own roles" policy).
 */
export function useIsModerator() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-moderator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      const roles = (data ?? []).map((r) => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isModerator: roles.includes("moderator") || roles.includes("admin"),
      };
    },
  });
}
