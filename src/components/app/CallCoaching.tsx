import { useMemo, useState } from "react";
import { RefreshCw, Quote, ArrowRight } from "lucide-react";
import { coachingGroups, normalizeCoaching } from "../../../supabase/functions/_shared/coaching-signals";
import { invokeEdge } from "@/lib/invokeEdge";

/** V1 review presentation backed by the original call analysis, not fixture adapters. */
export function CallCoaching({ callId, transcript, coaching, partial, onAnalyzed }: {
  callId: string; transcript: string | null; coaching: unknown; partial: boolean;
  onAnalyzed: () => Promise<void>;
}) {
  const [category, setCategory] = useState("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const stored = coaching && typeof coaching === "object" ? coaching as Record<string, unknown> : null;
  const report = useMemo(() => normalizeCoaching(stored?.signals, transcript ?? ""), [coaching, transcript]);
  const visible = report.signals.filter(s => category === "all" || s.category === category);
  const supported = new Set(report.signals.map(s => s.category));
  async function analyze() {
    setPending(true); setError(null); setUpdated(false);
    try {
      const result = await invokeEdge<{ ok: boolean; skipped?: string }>("analyze-call", { call_id: callId }, { timeoutMs: 120000, retries: 0 });
      if (!result.ok || result.skipped) throw new Error("Analysis was not completed. Refresh and try again.");
      await onAnalyzed(); setUpdated(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not analyze this call."); }
    finally { setPending(false); }
  }
  return <div className="space-y-6 p-5 sm:p-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="type-mono-micro text-by-text-secondary">CALL REVIEW / COACHING</p>
        <h2 className="type-editorial-h1 mt-2">The moments that matter.</h2>
        <p className="type-ui-small mt-2 max-w-xl text-by-text-secondary">What was said. What followed. What to practice next.</p></div>
      <button disabled={!transcript || pending} onClick={() => void analyze()} className="type-ui-small inline-flex items-center gap-2 rounded-by-control bg-by-surface-control-dark px-4 py-2.5 text-by-text-on-control disabled:opacity-50">
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />{pending ? "Analyzing call…" : stored ? "Re-analyze coaching" : "Generate coaching"}
      </button>
    </header>
    {error && <p role="alert" className="rounded-by-control border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} Your existing review has not been removed.</p>}
    {updated && <p role="status" className="type-ui-small">{stored ? "Call analysis refreshed." : "Analysis completed, but this backend has not returned the new coaching contract yet. Existing insights are preserved."}</p>}
    {partial && <p role="status" className="type-ui-small rounded-by-control bg-amber-50 p-3 text-amber-900">Partial coverage: only the first 24,000 transcript characters were analyzed. Missing findings do not mean the behavior never occurred.</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[["SUPPORTED MOMENTS", report.signals.length], ["SECTIONS WITH EVIDENCE", `${supported.size} / 16`], ["ANALYSIS BASIS", "Transcript evidence"]].map(([label, value]) => <div key={label} className="rounded-by-card border border-by-border-engraved p-4"><p className="type-mono-micro text-by-text-secondary">{label}</p><p className="type-editorial-insight mt-2">{value}</p></div>)}
    </div>
    <nav aria-label="Coaching sections" className="flex flex-wrap gap-2">
      {[{ key: "all", label: "All moments" }, ...coachingGroups].map(g => <button key={g.key} aria-pressed={category === g.key} onClick={() => setCategory(g.key)} className={`type-ui-small rounded-by-pill border px-3 py-1.5 ${category === g.key ? "border-by-surface-control-dark bg-by-surface-control-dark text-by-text-on-control" : "border-by-border-engraved text-by-text-secondary"}`}>{g.label}</button>)}
    </nav>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        {!visible.length && <section className="rounded-by-card border border-dashed border-by-border-engraved p-7"><h3 className="type-editorial-insight">{!transcript ? "A transcript is needed." : !stored ? "Ready for a closer look." : "No supported moments in this section."}</h3><p className="type-ui-small mt-3 text-by-text-secondary">{!transcript ? "Import an MP3/MP4 or sync an accessible CRM transcript first." : !stored ? "Generate coaching to analyze this call against the new signal framework." : "No evidence was returned for this category. This is not a zero score or proof that a behavior was absent."}</p></section>}
        {visible.map((s, i) => <article key={`${s.category}:${s.source_offset}`} className="overflow-hidden rounded-by-card border border-by-border-engraved">
          <header className="flex items-center justify-between gap-3 border-b border-by-border-engraved bg-by-surface-inset px-4 py-3"><span className="type-mono-micro text-by-text-secondary">{coachingGroups.find(g => g.key === s.category)?.label}</span><span className="type-mono-micro">Moment {i + 1} · quote verified</span></header>
          <div className="space-y-4 p-4"><h3 className="type-ui-title">{s.signal}</h3>
            <blockquote className="type-ui-body border-l-2 border-by-border-control pl-4"><Quote size={14} className="mb-2 text-by-text-tertiary" />{s.evidence_quote}</blockquote>
            <p className="type-ui-small text-by-text-secondary">{s.context}</p>
            <div className="grid gap-3 sm:grid-cols-2"><Evidence label="REP STATEMENT" quote={s.rep_quote} /><Evidence label="BUYER RESPONSE" quote={s.buyer_quote} /></div>
            <div className="rounded-by-control bg-by-surface-inset p-4"><p className="type-mono-micro text-by-text-secondary">COACHING INTERPRETATION · NOT CAUSATION</p><p className="type-ui-small mt-2">{s.interpretation || "No interpretation provided."}</p></div>
            {s.practice && <p className="type-ui-small flex gap-2"><ArrowRight size={16} className="mt-0.5 shrink-0" /><span><strong>Try next time:</strong> {s.practice}</span></p>}
          </div>
        </article>)}
      </div>
      <aside className="space-y-5">
        <section className="rounded-by-card bg-by-surface-control-dark p-5 text-by-text-on-control"><h3 className="type-mono-micro text-by-text-on-dark-muted">EVIDENCE FIRST</h3><p className="type-editorial-insight mt-3">Coach the behavior. Don’t guess the person.</p><p className="type-ui-small mt-3">No emotion scores, personality labels, or inferred buyer intent. Quoted evidence is verified; AI interpretations still need human review.</p></section>
        <section className="rounded-by-card border border-by-border-engraved p-4"><h3 className="type-ui-label">INPUT COVERAGE</h3><ul className="type-ui-small mt-3 space-y-3 text-by-text-secondary"><li>Transcript: {transcript ? "available" : "missing"}</li><li>Acoustic measurements: not computed</li><li>Validated timing: not used in this report</li><li>Rep baseline: not computed</li><li>Stage: evidence-based labels only, no invented boundaries</li></ul></section>
      </aside>
    </div>
    <details className="rounded-by-card border border-by-border-engraved p-4"><summary className="type-ui-title cursor-pointer">Full coaching framework · 16 sections</summary><div className="mt-5 grid gap-5 sm:grid-cols-2">{coachingGroups.map(g => <section key={g.key}><h3 className="type-ui-title">{g.label}</h3><p className="type-ui-small mt-2 text-by-text-secondary">{g.fields.split("|").join(" · ")}</p><p className="type-mono-micro mt-3">Needs: {g.requires}</p></section>)}</div></details>
  </div>;
}

function Evidence({ label, quote }: { label: string; quote: string }) {
  return <div className="rounded-by-control border border-by-border-engraved p-3"><p className="type-mono-micro text-by-text-secondary">{label}</p><p className="type-ui-small mt-2">{quote || "Not evidenced in this moment."}</p></div>;
}
