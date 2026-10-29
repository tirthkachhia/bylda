import { Inactive } from "@/components/app/FigmaPrimitives";
import { FigmaCallTimeline } from "./FigmaCallTimeline";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, formatWhen, segmentLines, type CoachingCall } from "@/lib/coaching/calls";
import {
  secondsFromCitation,
  timeLabel,
  type BehaviorAnalysis,
  type Evidence,
} from "@/lib/coaching/behavior";
import { BehaviorInsights, EvidenceLinks } from "./BehaviorInsights";
import { CallRecording } from "./CallRecording";
import { CallScores } from "./CallScores";
export type DetailTab = "summary" | "transcript" | "analysis" | "methodology" | "scores";
export function CallDetail({
  call,
  tab,
  onTab,
  onReanalyze,
  onDelete,
  seekSeconds = null,
  seekRequest = 0,
  sourceTurns = null,
  sourceAnalysis = null,
  sourceRunId = null,
  sourceState = "legacy",
  highlightedTurnId = null,
  focusedOccurrenceKey = null,
}: {
  call: CoachingCall;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onReanalyze?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  seekSeconds?: number | null;
  seekRequest?: number;
  sourceTurns?: Evidence[] | null;
  sourceAnalysis?: BehaviorAnalysis | null;
  sourceRunId?: string | null;
  sourceState?: "loading" | "unavailable" | "ready" | "legacy";
  highlightedTurnId?: number | null;
  focusedOccurrenceKey?: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [localSeek, setLocalSeek] = useState(seekSeconds),
    [request, setRequest] = useState(seekRequest),
    [highlight, setHighlight] = useState<number | null>(highlightedTurnId),
    [moment, setMoment] = useState<string | null>(focusedOccurrenceKey),
    [transcriptSearch, setTranscriptSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    setTranscriptSearch("");
    setLocalSeek(seekSeconds);
    setRequest(seekRequest);
    setHighlight(highlightedTurnId);
    setMoment(focusedOccurrenceKey);
  }, [seekSeconds, seekRequest, highlightedTurnId, focusedOccurrenceKey, sourceRunId]);
  const processing = ["queued", "transcribing", "scoring", "analyzing"].includes(
    call.coaching_stage ?? "",
  );
  const analysis = sourceAnalysis;
  const vertical = call.insight?.vertical_insights ?? {};
  const legacyLines = useMemo(() => segmentLines(call), [call]);
  const lines = sourceTurns
    ? sourceTurns.map((e) => ({
        key: `${sourceRunId}:${e.turn_id}`,
        turnId: e.turn_id,
        time: timeLabel(e.start_s),
        seconds: e.start_s,
        speaker: e.speaker,
        text: e.text,
      }))
    : sourceState === "legacy"
      ? legacyLines.map((line) => ({
          ...line,
          turnId: null,
          seconds: secondsFromCitation(line.time),
        }))
      : [];
  const visible = lines.filter((line) =>
    `${line.speaker} ${line.text}`.toLowerCase().includes(transcriptSearch.toLowerCase()),
  );
  useEffect(() => {
    if (tab !== "summary" && tab !== "transcript") return;
    const id = requestAnimationFrame(() => {
      const scope = root.current;
      if (!scope) return;
      const exact =
        highlight !== null
          ? scope.querySelector<HTMLElement>(`[data-source-turn="${highlight}"]`)
          : null;
      const timed =
        localSeek === null
          ? null
          : [...scope.querySelectorAll<HTMLElement>("[data-call-time]")]
              .filter((e) => Number(e.dataset.callTime) <= localSeek)
              .at(-1);
      (exact ?? timed)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [tab, highlight, localSeek, request, sourceRunId]);
  const seek = (seconds: number) => {
    setLocalSeek(seconds);
    setRequest((v) => v + 1);
  };
  const selectEvidence = (e: Evidence, destination?: DetailTab) => {
    setHighlight(e.turn_id);
    setTranscriptSearch("");
    setLocalSeek(e.start_s);
    setRequest((v) => v + 1);
    if (destination && destination !== tab) onTab(destination);
    else if (!destination && tab !== "summary") onTab("transcript");
  };
  async function reanalyze() {
    if (!onReanalyze || busy) return;
    setBusy(true);
    try {
      await onReanalyze(call.id);
      toast.success("Call queued for re-analysis");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-analysis failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !onDelete ||
      deleting ||
      !window.confirm("Delete this call, recording and retained analysis history?")
    )
      return;
    setDeleting(true);
    try {
      await onDelete(call.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }
  const transcript = (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-by-border-engraved"
      aria-label="Call transcript"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-by-border-engraved px-4 py-3">
        <h2 className="text-xs font-medium uppercase">Transcript</h2>
        <input
          aria-label="Search transcript"
          placeholder="Search transcript…"
          value={transcriptSearch}
          onChange={(event) => setTranscriptSearch(event.target.value)}
          className="max-w-full rounded-md border border-by-border-control px-2 py-1.5 text-xs"
        />
      </header>
      {sourceState === "ready" && (
        <p className="border-b border-by-border-engraved px-4 py-2 text-[10px] text-by-text-tertiary">
          Retained analysis snapshot · speaker and timing estimates
        </p>
      )}
      <div className="max-h-[760px] overflow-y-auto">
        {visible.map((line) => (
          <div
            key={line.key}
            data-source-turn={line.turnId ?? undefined}
            data-call-time={line.seconds ?? undefined}
            className={`grid grid-cols-[75px_minmax(0,1fr)] gap-3 border-b border-by-border-engraved p-4 text-[13px] ${highlight !== null && highlight === line.turnId ? "bg-amber-100" : "bg-white"}`}
          >
            <div>
              <button
                type="button"
                disabled={line.seconds === null && line.turnId === null}
                onClick={() => {
                  if (line.seconds !== null) seek(line.seconds);
                  setHighlight(line.turnId);
                }}
                className="font-mono text-[11px] underline-offset-4 hover:underline disabled:text-by-text-tertiary"
              >
                {line.time}
              </button>
              <p className="mt-1 break-words text-[10px] font-medium uppercase text-by-text-secondary">
                {line.speaker}
              </p>
            </div>
            <p className="whitespace-pre-wrap break-words leading-6">{line.text}</p>
          </div>
        ))}
        {!visible.length && (
          <p className="p-6 text-sm leading-6 text-by-text-secondary">
            {sourceState === "loading"
              ? "Loading the retained transcript…"
              : sourceState === "unavailable"
                ? "The cited source snapshot is unavailable. Another transcript has not been substituted."
                : transcriptSearch
                  ? "No transcript lines match your search."
                  : "No transcript available yet."}
          </p>
        )}
      </div>
    </section>
  );
  const execution = analysis?.execution;
  const legacyItems = Array.isArray(vertical.playbook_adherence) ? vertical.playbook_adherence : [];
  const items = execution?.items ?? legacyItems;
  return (
    <div
      ref={root}
      className="space-y-4 rounded-xl border border-by-border-engraved bg-white p-4 shadow-sm sm:p-6"
      data-design-screen="call-review"
    >
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-xl">{call.dealName ?? call.contactName}</h1>
            <p className="mt-2 text-xs leading-6 text-by-text-secondary">
              {call.repName ?? "Unassigned rep"} · {formatWhen(call.started_at ?? call.created_at)}{" "}
              · {formatDuration(call.duration)} · {call.direction}
            </p>
            <p className="text-xs leading-6 text-by-text-secondary">
              {call.company}
              {call.dealStage ? ` · CRM stage: ${call.dealStage}` : ""}
              {typeof call.dealValue === "number"
                ? ` · CRM value: ${call.dealValue.toLocaleString()}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Inactive>Share</Inactive>
            <Inactive>Add note</Inactive>
            <Inactive>Assign coaching</Inactive>
            {onReanalyze && call.transcript && (
              <button
                type="button"
                disabled={busy || processing}
                onClick={() => void reanalyze()}
                className="flex items-center gap-2 rounded-md border border-by-border-control px-3 py-2 text-xs disabled:opacity-40"
              >
                <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
                Re-analyze
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                disabled={deleting}
                aria-label="Delete call"
                onClick={() => void remove()}
                className="rounded-md border border-by-border-control p-2 text-red-700 disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </header>
      {processing && (
        <p
          role="status"
          className="rounded-lg border border-by-border-engraved bg-white p-3 text-xs"
        >
          Call analysis is being prepared.
          {analysis
            ? " Retained evidence stays visible until the new result is ready."
            : " Evidence will appear when processing completes."}
        </p>
      )}
      {call.coaching_stage?.includes("failed") && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          {call.coaching_error ||
            "Latest processing did not complete. Previous retained results are preserved; re-analyze to retry."}
        </p>
      )}
      {analysis && (
        <section className="grid gap-4 rounded-xl border border-by-border-engraved bg-by-surface-hover p-4 md:grid-cols-[minmax(0,1fr)_230px]">
          <div>
            <h2 className="text-[11px] font-medium uppercase">Bylda summary</h2>
            <p className="mt-2 text-[13px] leading-6">{analysis.final_state.label}</p>
            <p className="mt-1 text-[11px] text-by-text-secondary">
              {analysis.final_state.verification.replaceAll("_", " ")}
            </p>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt>Call objective</dt>
              <dd>{analysis.context.objective}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Transcript coverage</dt>
              <dd>
                {analysis.coverage.analyzed_turns}/{analysis.coverage.total_turns} turns
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Playbook version</dt>
              <dd>{execution?.playbook ? `v${execution.playbook.version}` : "None recorded"}</dd>
            </div>
          </dl>
        </section>
      )}
      {sourceState === "unavailable" && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
          The requested analysis source is unavailable. The current call’s transcript has not
          replaced it.
        </p>
      )}
      <nav
        aria-label="Call review sections"
        className="flex gap-5 overflow-x-auto border-b border-by-border-engraved"
      >
        {(
          [
            ["summary", "Overview"],
            ["transcript", "Transcript"],
            ["analysis", "Analysis"],
            ["methodology", "Methodology"],
            ["scores", "Learning moments"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => onTab(key)}
            className={`shrink-0 border-b-2 px-1 py-3 text-[13px] ${tab === key ? "border-by-text-primary font-medium" : "border-transparent text-by-text-secondary"}`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled
          title="Not available yet"
          className="shrink-0 px-1 py-3 text-[13px] text-by-text-tertiary"
        >
          Notes
        </button>
      </nav>
      <CallRecording
        key={call.id}
        path={call.audio_path}
        recordingUrl={call.recording_url}
        seekSeconds={localSeek}
        seekRequest={request}
      />
      <FigmaCallTimeline
        analysis={analysis ?? null}
        duration={call.duration}
        onSelect={(e, key) => {
          setMoment(key);
          selectEvidence(e, "summary");
        }}
      />
      {tab === "scores" ? (
        <>
          <p className="text-xs leading-5 text-by-text-secondary">
            Exchange-scoring moments are observations for review, not verified outcomes or
            compliance decisions.
          </p>
          <CallScores
            callId={call.id}
            onSeek={(seconds) => {
              setHighlight(null);
              setTranscriptSearch("");
              seek(seconds);
              onTab("transcript");
            }}
          />
        </>
      ) : tab === "methodology" ? (
        <section>
          <h2 className="text-base">
            {execution?.playbook
              ? `${execution.playbook.name} · v${execution.playbook.version}`
              : vertical.playbook
                ? `${vertical.playbook.name} · v${vertical.playbook.version}`
                : "No playbook recorded"}
          </h2>
          <p className="mt-2 text-xs leading-6 text-by-text-secondary">
            Execution against the analysis-time version. Adaptation can fulfill an objective;
            unknown evidence is not a missed step.
          </p>
          <ul className="mt-4 divide-y divide-by-border-engraved">
            {items.map((item, index) => (
              <li key={item.guideline_id ?? item.code ?? index} className="py-4 text-[13px]">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="font-mono text-xs text-by-text-tertiary">{item.code}</span>
                  <strong className="flex-1 font-medium">{item.guideline}</strong>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] ${["followed", "adapted"].includes(item.status) ? "bg-emerald-100 text-emerald-900" : ["partial", "missed"].includes(item.status) ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-600"}`}
                  >
                    {item.status === "not_observable"
                      ? "Unknown"
                      : (item.status?.replaceAll("_", " ") ?? "Unknown")}
                  </span>
                </div>
                {item.note && (
                  <p className="mt-2 text-xs leading-6 text-by-text-secondary">{item.note}</p>
                )}
                {item.source_evidence?.length ? (
                  <EvidenceLinks
                    evidence={item.source_evidence}
                    onSeek={seek}
                    onSelect={selectEvidence}
                  />
                ) : item.evidence_quote ? (
                  <blockquote className="mt-3 rounded-md bg-by-surface-hover p-3 text-xs leading-6">
                    “{item.evidence_quote}”
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
          {!items.length && (
            <p className="py-8 text-sm text-by-text-secondary">
              No guideline judgments are available for this call.
            </p>
          )}
        </section>
      ) : tab === "transcript" ? (
        transcript
      ) : (
        <div className={`grid gap-4 ${tab === "summary" ? "xl:grid-cols-2" : ""}`}>
          {tab === "summary" && transcript}
          <section className="min-w-0 rounded-xl border border-by-border-engraved p-4">
            {analysis && sourceRunId ? (
              <BehaviorInsights
                key={sourceRunId}
                analysis={analysis}
                runId={sourceRunId}
                onSeek={seek}
                onSelectEvidence={selectEvidence}
                mode={tab === "analysis" ? "analysis" : "overview"}
                focusedOccurrenceKey={moment}
                onChooseMoment={(key, e) => {
                  setMoment(key);
                  if (e) selectEvidence(e, tab === "analysis" ? "analysis" : "summary");
                }}
              />
            ) : sourceState === "loading" ? (
              <p role="status" className="text-sm text-by-text-secondary">
                Loading retained analysis…
              </p>
            ) : sourceState === "unavailable" ? (
              <p className="text-sm text-by-text-secondary">
                The retained analysis could not be opened. Return to Calls or retry the source link.
              </p>
            ) : (
              <LegacySummary call={call} />
            )}
          </section>
        </div>
      )}
      <p className="text-[10px] leading-5 text-by-text-tertiary">
        AI analysis of available transcript evidence. Recording completeness, speaker attribution
        and timing are not independently verified.
        {vertical.analysis_coverage?.partial
          ? ` Legacy extraction is partial: ${vertical.analysis_coverage.analyzed_characters} of ${vertical.analysis_coverage.total_characters} characters.`
          : ""}
      </p>
    </div>
  );
}
function LegacySummary({ call }: { call: CoachingCall }) {
  const vertical = call.insight?.vertical_insights ?? {};
  return (
    <div className="space-y-4">
      <h2 className="text-base">Call summary</h2>
      <p className="text-[13px] leading-6 text-by-text-secondary">
        {call.insight?.summary ??
          (call.transcript ? "Analysis pending." : "Waiting for a transcript.")}
      </p>
      {vertical.coaching?.next_call_focus && (
        <p className="rounded-lg border border-by-border-engraved p-3 text-sm">
          Next call: {vertical.coaching.next_call_focus}
        </p>
      )}
      {[...(vertical.coaching?.strengths ?? []), ...(vertical.coaching?.improvements ?? [])].map(
        (point: { point: string; evidence_quote?: string }, i: number) => (
          <article
            key={i}
            className="rounded-lg border border-by-border-engraved p-3 text-xs leading-6"
          >
            <p>{point.point}</p>
            {point.evidence_quote && (
              <blockquote className="mt-2 text-by-text-secondary">
                “{point.evidence_quote}”
              </blockquote>
            )}
          </article>
        ),
      )}
      <p className="text-xs text-by-text-tertiary">
        This is a legacy analysis. Re-analyze to create source-linked behavioral history.
      </p>
    </div>
  );
}
