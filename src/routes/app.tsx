import React, { useState } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { IntelligenceRail } from "@/components/app/IntelligenceRail";
import { GuestGateModal } from "@/components/app/GuestGateModal";
import { ByldaBar } from "@/components/bylda/ByldaBar";
import { NextBestActionBar } from "@/components/app/NextBestActionBar";
import { CoachmarkListener } from "@/components/launchpad/Coachmark";
import { supabase } from "@/integrations/supabase/client";
import { guestStore, isDemoEmail } from "@/lib/guest";
import { useImpersonation, impersonationStore } from "@/lib/impersonation";
import { saveLastAppPath } from "@/lib/session-restore";
import { workspaceStatusQuery, currentMissionQuery } from "@/lib/queries";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import type { QueryClient } from "@tanstack/react-query";

const onboardedUsers = new Set<string>();

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location, context }) => {
    if (guestStore.get().isGuest) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth/sign-in", search: { redirect: location.href } as never });
    }

    // Demo account: switch on the populated client-side demo and skip the
    // onboarding gate, deterministically (don't depend on AuthProvider timing).
    if (isDemoEmail(session.user.email)) {
      guestStore.enable();
      return;
    }

    // Warm the Home-critical queries while the route renders — not awaited,
    // so navigation never blocks on them (design system §10).
    const qc = (context as { queryClient?: QueryClient }).queryClient;
    if (qc) {
      void qc.prefetchQuery(workspaceStatusQuery(session.user.id));
      void qc.prefetchQuery(currentMissionQuery(session.user.id));
    }

    if (onboardedUsers.has(session.user.id)) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!profile?.onboarding_complete) {
      throw redirect({ to: "/onboarding" });
    }
    onboardedUsers.add(session.user.id);
  },
  component: AppLayout,
});

// Sticky warning bar shown while an admin is acting inside another account.
function ImpersonationBanner() {
  const imp = useImpersonation();
  if (!imp.active) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-1.5 text-[12.5px] font-medium text-black">
      <span className="truncate">
        Admin mode — acting as <strong>{imp.label ?? "account"}</strong>. Changes affect their
        account.
      </span>
      <button
        onClick={() => {
          impersonationStore.stop();
          window.location.assign("/app/admin");
        }}
        className="shrink-0 rounded-md bg-black/85 px-3 py-1 font-semibold text-white hover:bg-black"
      >
        Exit
      </button>
    </div>
  );
}

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Product identity: the shell is either Launchpad (create, violet) or
  // Bylda (operate, cyan). data-product remaps the semantic accent tokens
  // (styles.css) so the whole shell re-skins with the active product.
  const { isOperate } = useWorkspaceMode();

  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem("bylda-rail-open") !== "0";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    saveLastAppPath(path);
  }, [path]);

  const toggleRail = () => {
    setRailOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem("bylda-rail-open", next ? "1" : "0");
      } catch {
        /* */
      }
      return next;
    });
  };

  return (
    <div
      data-product={isOperate ? "bylda" : "launchpad"}
      className="flex h-screen overflow-hidden bg-background text-foreground"
    >
      <AppSidebar onOpenRail={() => setRailOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <AppTopbar onToggleRail={toggleRail} railOpen={railOpen} />
        <ByldaBar />

        <div className="flex flex-1 overflow-hidden">
          <main
            className="flex-1 overflow-x-hidden overflow-y-auto"
            style={{ paddingBottom: railOpen ? 360 : 0 }}
          >
            <NextBestActionBar />
            <div key={path} className="page-in w-full px-5 py-5 pb-20 md:px-7 md:py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <IntelligenceRail open={railOpen} onClose={() => setRailOpen(false)} />

      <MobileTabBar />
      <GuestGateModal />
      <CoachmarkListener />
    </div>
  );
}
