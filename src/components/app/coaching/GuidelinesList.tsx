import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { extractPlaybookGuidelines, playbookGuidelinesQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
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
  const qc = useQueryClient(),
    q = useQuery(playbookGuidelinesQuery(versionId));
  const [busy, setBusy] = useState(false),
    [phase, setPhase] = useState<string | null>(null);
  const rows = q.data ?? [];
  const phases = [...new Set(rows.map((r) => r.phase))];
  const shown = phase ? rows.filter((r) => r.phase === phase) : rows;
  const extract = async () => {
    setBusy(true);
    try {
      const result = await extractPlaybookGuidelines(versionId);
      await qc.invalidateQueries({ queryKey: ["playbook-guidelines", versionId] });
      toast.success(`${result.guidelines.length} guidelines extracted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extract guidelines");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base">Observable guidelines</h2>
          <p className="mt-1 text-xs text-by-text-secondary">
            Extracted from this saved version · {rows.length} guidelines
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || q.isPending}
          onClick={() => void extract()}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{" "}
          {rows.length ? "Re-extract" : "Extract guidelines"}
        </Button>
      </header>
      {q.isPending ? (
        <p role="status" className="p-5 text-sm">
          Loading guidelines…
        </p>
      ) : q.error ? (
        <p role="alert" className="rounded-xl border border-red-200 p-5 text-sm text-red-700">
          Guidelines unavailable.{" "}
          <button type="button" className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : !rows.length ? (
        <p className="rounded-xl border border-by-border-engraved p-6 text-sm leading-6 text-by-text-secondary">
          {busy
            ? "Reading the saved playbook…"
            : "No guidelines extracted yet. Extract a checklist of observable actions from this saved version."}
        </p>
      ) : (
        <>
          <div role="group" aria-label="Guideline phases" className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={phase === null}
              onClick={() => setPhase(null)}
              className={`rounded-lg border px-3 py-2 text-xs ${phase === null ? "border-by-text-primary bg-by-surface-sidebar" : "border-by-border-engraved"}`}
            >
              All · {rows.length}
            </button>
            {phases.map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={phase === p}
                onClick={() => setPhase(p)}
                className={`rounded-lg border px-3 py-2 text-xs ${phase === p ? "border-by-text-primary bg-by-surface-sidebar" : "border-by-border-engraved"}`}
              >
                {PHASE_LABEL[p] ?? p} · {rows.filter((r) => r.phase === p).length}
              </button>
            ))}
          </div>
          <ol className="overflow-hidden rounded-xl border border-by-border-engraved">
            {shown.map((row) => (
              <li
                key={row.id}
                className="flex gap-4 border-b border-by-border-engraved p-4 text-[13px]"
              >
                <span className="font-mono text-xs text-by-text-tertiary">{row.code}</span>
                <div>
                  <p className="font-medium">{row.title}</p>
                  {row.detail && (
                    <p className="mt-2 leading-6 text-by-text-secondary">{row.detail}</p>
                  )}
                  <span className="mt-2 inline-block rounded-full border border-by-border-engraved px-2 py-0.5 text-[11px]">
                    {PHASE_LABEL[row.phase] ?? row.phase}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
