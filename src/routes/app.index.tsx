// Post-onboarding routing — never a generic app home. The landing follows
// the active product: builders land in Launchpad's mission control, operators
// land in Bylda's command center. Guests carry their choice in sessionStorage.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { guestStore } from "@/lib/guest";
import { resolveLandingPath } from "@/lib/ecosystem";

export const Route = createFileRoute("/app/")({
  beforeLoad: async () => {
    let mode: "create" | "operate" = "create";

    if (guestStore.get().isGuest) {
      try {
        if (sessionStorage.getItem("bylda-view-mode") === "operate") mode = "operate";
      } catch {
        /* default to create */
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("workspaces")
          .select("mode")
          .eq("owner_id", session.user.id)
          .maybeSingle();
        if (data?.mode === "operate") mode = "operate";
      }
    }

    throw redirect({ to: resolveLandingPath(mode) });
  },
});
