import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Returns true when the signed-in user has the `admin` app_role.
 * Reads via the user_roles table (RLS allows reading own roles).
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["is_admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isAdmin: !!q.data, loading: q.isLoading };
}
