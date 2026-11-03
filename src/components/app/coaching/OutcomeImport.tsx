import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { coachingManagerPermissionQuery } from "@/lib/queries";
import { parseOutcomeCsv, type ImportedOutcome } from "@/lib/coaching/outcomes";
import { downloadFile, csvText } from "@/lib/download";
export function OutcomeImport() {
  const { currentOrgId, user } = useAuth(),
    permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? "")),
    qc = useQueryClient();
  const [rows, setRows] = useState<ImportedOutcome[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function read(file: File) {
    setMessage("");
    try {
      if (file.size > 1024 * 1024) throw new Error("Choose a CSV up to 1 MB.");
      setRows(parseOutcomeCsv(await file.text()));
    } catch (e) {
      setRows([]);
      setMessage(e instanceof Error ? e.message : "CSV could not be read.");
    }
  }
  async function save() {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("import_coaching_outcomes", {
        p_org: currentOrgId,
        p_rows: rows,
      });
      if (error) throw error;
      setMessage(`${data} outcome records imported; exact duplicates were skipped.`);
      setRows([]);
      await qc.invalidateQueries({ queryKey: ["recorded-outcomes", currentOrgId] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h2>Import recorded outcomes</h2>
      <p className="text-xs">
        CSV records are labelled manager-recorded, not independently verified. Match each row to a
        call already saved in this workspace. Supported outcomes: application_completed, approved,
        placed, declined, cancelled, unknown.
      </p>
      <button
        className="figma-button"
        onClick={() =>
          downloadFile(
            "outcome-template.csv",
            csvText([["call_id", "outcome", "occurred_at", "source_reference"]]),
          )
        }
      >
        Download CSV template
      </button>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose outcome CSV"
        disabled={!permission.data || busy}
        onChange={(e) => {
          if (e.target.files?.[0]) void read(e.target.files[0]);
        }}
      />
      {rows.length > 0 && (
        <>
          <p className="text-sm">{rows.length} rows ready. Review the first five:</p>
          <pre className="overflow-auto text-xs">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
          <button
            className="figma-button"
            disabled={busy || !permission.data}
            onClick={() => void save()}
          >
            Save {rows.length} outcome records
          </button>
        </>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
