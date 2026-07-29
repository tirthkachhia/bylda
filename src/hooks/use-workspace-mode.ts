// useWorkspaceMode — the single source of truth for the active "view":
//   Launchpad (create & launch)  ↔  BYLDA (operate & scale).
//
// The view is backed by workspaces.mode ('create' | 'operate'), the same
// column the onboarding fork sets. Switching the view writes the new mode
// (RLS: workspaces_update_owner) and optimistically updates the cache so the
// whole shell re-skins instantly. Guests have no row, so their choice lives
// in sessionStorage and never hits the database.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";
import { workspaceStatusQuery } from "@/lib/queries";

export type WorkspaceMode = "create" | "operate";
export type WorkspaceView = "launchpad" | "bylda";

const GUEST_VIEW_KEY = "bylda-view-mode";

function readGuestMode(): WorkspaceMode {
  if (typeof window === "undefined") return "create";
  try {
    return sessionStorage.getItem(GUEST_VIEW_KEY) === "operate" ? "operate" : "create";
  } catch {
    return "create";
  }
}

function writeGuestMode(mode: WorkspaceMode) {
  try {
    sessionStorage.setItem(GUEST_VIEW_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function useWorkspaceMode() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const wsQ = useQuery({
    ...workspaceStatusQuery(userId),
    enabled: !!userId && !isGuest,
  });

  const [guestMode, setGuestMode] = useState<WorkspaceMode>(readGuestMode);

  const mode: WorkspaceMode = isGuest
    ? guestMode
    : ((wsQ.data as { mode?: WorkspaceMode } | null)?.mode ?? "create");

  const statusKey = ["workspace-status", userId] as const;

  const mutation = useMutation({
    mutationFn: async (next: WorkspaceMode) => {
      if (isGuest) {
        writeGuestMode(next);
        return next;
      }
      const { error } = await supabase
        .from("workspaces")
        .update({ mode: next })
        .eq("owner_id", userId);
      if (error) throw error;
      return next;
    },
    onMutate: async (next: WorkspaceMode) => {
      if (isGuest) {
        setGuestMode(next);
        return {};
      }
      await qc.cancelQueries({ queryKey: statusKey });
      const prev = qc.getQueryData(statusKey);
      qc.setQueryData(statusKey, (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), mode: next } : old,
      );
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (!isGuest && ctx && "prev" in ctx) qc.setQueryData(statusKey, ctx.prev);
    },
    onSettled: () => {
      if (!isGuest) qc.invalidateQueries({ queryKey: statusKey });
    },
  });

  const setMode = (next: WorkspaceMode) => {
    if (next !== mode) mutation.mutate(next);
  };

  return {
    mode,
    view: (mode === "operate" ? "bylda" : "launchpad") as WorkspaceView,
    isOperate: mode === "operate",
    setMode,
    toggle: () => setMode(mode === "operate" ? "create" : "operate"),
    isPending: mutation.isPending,
  };
}
