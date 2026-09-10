import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

/**
 * Compatibility adapter retained during the migration so callers do not need
 * to change yet. OAuth is now handled directly by Supabase instead of Lovable.
 */
export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "azure" | "facebook",
      opts?: SignInOptions,
    ) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
        },
      });

      return {
        error,
        redirected: Boolean(data?.url),
        url: data?.url ?? null,
      };
    },
  },
};
