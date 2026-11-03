import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
export function WorkspacePicker() {
  const { user, currentOrgId, currentOrg, switchWorkspace } = useAuth(),
    qc = useQueryClient(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["workspace-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id,organizations(name)")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mb-5 space-y-2">
      <label className="text-[10px] uppercase text-by-text-secondary" htmlFor="workspace-picker">
        Workspace
      </label>
      <select
        id="workspace-picker"
        className="w-full rounded-lg bg-by-surface-sidebar-active/40 p-2 text-xs"
        value={currentOrgId ?? ""}
        disabled={busy || q.isPending || !!q.error}
        onChange={(e) => {
          const id = e.target.value;
          setBusy(true);
          setError("");
          void switchWorkspace(id)
            .then(async () => {
              qc.clear();
              await navigate({ to: "/app" });
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {!q.data?.length && (
          <option value={currentOrgId ?? ""}>{currentOrg?.name ?? "Your workspace"}</option>
        )}
        {q.data?.map((m) => {
          const value = m.organizations as unknown as { name: string } | { name: string }[];
          return (
            <option key={m.organization_id} value={m.organization_id}>
              {Array.isArray(value) ? value[0]?.name : value?.name}
            </option>
          );
        })}
      </select>
      {(error || q.error) && (
        <p role="alert" className="text-xs text-red-700">
          {error || "Workspaces could not load."}
        </p>
      )}
    </div>
  );
}
