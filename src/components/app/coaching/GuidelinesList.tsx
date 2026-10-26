/**
 * GuidelinesList — the behavior checklist extracted from a playbook version.
 * This is what reps are judged on, so the manager should see it next to the
 * text and be able to re-extract after a wording change.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { extractPlaybookGuidelines, playbookGuidelinesQuery } from "@/lib/queries";

const PHASE_LABEL: Record<string, string> = {
  opening: "Opening",
  discovery: "Discovery",
  presentation: "Presentation",
  objections: "Objections",
  close: "Close",
  compliance: "Compliance",
  other: "Other",
};

export function GuidelinesList({ versionId }: { versionId: string }) {
  const qc = useQueryClient();
  const q = useQuery(playbookGuidelinesQuery(versionId));
  const [busy, setBusy] = useState(false);
  const rows = q.data ?? [];

  const extract = async () => {
    setBusy(true);
    try {
      const res = await extractPlaybookGuidelines(versionId);
      await qc.invalidateQueries({ queryKey: ["playbook-guidelines", versionId] });
      toast.success(`${res.guidelines.length} guidelines extracted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not extract guidelines");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
          <ListChecks className="h-3.5 w-3.5" /> What reps are judged on
        </h3>
        <button
          type="button"
          onClick={() => void extract()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e5faf] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {rows.length ? "Re-extract" : "Extract guidelines"}
        </button>
      </div>
      {q.isLoading ? (
        <p className="text-[12px] text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[12px] text-neutral-500">
          {busy
            ? "Reading the playbook and listing the behaviors a reviewer can hear…"
            : "Not extracted yet. Extraction turns this version into a short checklist of behaviors; adherence, moments, and reports cite these by code."}
        </p>
      ) : (
        <ol className="divide-y divide-black/[0.06]">
          {rows.map((g) => (
            <li key={g.id} className="flex gap-3 py-2 text-[12px]">
              <span className="w-8 shrink-0 font-mono font-semibold text-neutral-500">
                {g.code}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{g.title}</span>
                  <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {PHASE_LABEL[g.phase] ?? g.phase}
                  </span>
                </div>
                {g.detail && <p className="mt-0.5 text-neutral-600">{g.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
