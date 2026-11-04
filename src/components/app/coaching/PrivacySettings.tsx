import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { invokeEdge } from "@/lib/invokeEdge";
import { downloadFile } from "@/lib/download";
export function PrivacySettings() {
  const { currentOrgId } = useAuth();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function exportData() {
    setBusy(true);
    setMessage("");
    try {
      const r = await invokeEdge<{ data: unknown }>(
        "coaching-data-controls",
        { organization_id: currentOrgId, action: "export" },
        { timeoutMs: 110000, retries: 0 },
      );
      downloadFile(
        "bylda-workspace-call-data.json",
        JSON.stringify(r.data, null, 2),
        "application/json",
      );
      setMessage("Workspace call-data export downloaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h1>Data & privacy</h1>
      <p className="text-sm leading-6">
        Call audio is private. Signed-in workspace members can review shared calls; private
        discussion rooms require membership. Human notes remain separate from retained AI evidence.
        Re-analysis preserves previous analysis runs and does not re-transcribe audio.
      </p>
      <button className="figma-button" disabled={busy} onClick={() => void exportData()}>
        {busy ? "Preparing export…" : "Export workspace call data"}
      </button>
      <p className="text-xs">
        Owner/admin access is required. The JSON export includes calls, transcripts, retained
        analyses, notes, assignments, guidance and generated reports. It excludes credentials,
        private-room messages and billing records.
      </p>
      <Link className="figma-button" to="/app/crm/calls">
        Review or delete individual calls
      </Link>
      <p className="text-xs">
        Deleting a call removes its source and dependent analysis history. Previously generated
        report quotations or manually copied discussion content may remain. Timed deletion and
        organization-wide redaction are not enabled by a display preference.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function DeleteWorkspace() {
  const { currentOrgId, currentOrg, user } = useAuth();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = currentOrg?.owner_id === user?.id;
  return (
    <section className="space-y-3">
      <p className="text-xs">
        Permanently removes the workspace and its dependent database records. Recording cleanup runs
        through the deployed background worker. External-provider copies are outside this workspace.
      </p>
      {allowed && (
        <label className="figma-field">
          Type DELETE {currentOrg?.name}
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      <button
        className="figma-button text-red-700"
        disabled={!allowed || busy || text !== `DELETE ${currentOrg?.name}`}
        onClick={() => {
          if (!window.confirm("Permanently delete this workspace and its call history?")) return;
          setBusy(true);
          void invokeEdge(
            "coaching-data-controls",
            { organization_id: currentOrgId, action: "delete_workspace", confirmation: text },
            { timeoutMs: 110000, retries: 0 },
          )
            .then(() => window.location.assign("/onboarding"))
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Delete workspace
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
