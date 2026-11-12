import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery } from "@/lib/queries";
import { readWorkspaceView, type WorkspaceView } from "./workspace-view-session";

const WorkspaceViewContext = createContext<WorkspaceView>("agent");
export const useWorkspaceView = () => useContext(WorkspaceViewContext);

export function WorkspaceViewProvider({ children }: { children: ReactNode }) {
  const { user, currentOrgId } = useAuth();
  const userId = user?.id;
  const [selection, setSelection] = useState<{ userId: string; view: WorkspaceView } | null>(null);
  useEffect(() => {
    setSelection(userId ? { userId, view: readWorkspaceView(userId) } : null);
  }, [userId]);
  const requested = selection?.userId === user?.id ? selection?.view : undefined;
  const permission = useQuery({
    ...coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""),
    enabled: requested === "manager" && !!currentOrgId && !!user,
  });
  if (!requested || (requested === "manager" && !!currentOrgId && permission.isPending))
    return <p role="status">Loading your workspace…</p>;
  if (requested === "manager" && permission.isError)
    return (
      <p role="alert">
        Manager access could not load.{" "}
        <button onClick={() => void permission.refetch()}>Retry</button>
      </p>
    );
  const view = requested === "manager" && permission.data === true ? "manager" : "agent";
  return <WorkspaceViewContext.Provider value={view}>{children}</WorkspaceViewContext.Provider>;
}
