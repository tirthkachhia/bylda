import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  behaviorRunSourceQuery,
  reportCitationSeconds,
  secondsFromCitation,
  timeLabel,
} from "@/lib/coaching/behavior";
import { coachingCallQuery, formatDuration, segmentLines } from "@/lib/coaching/calls";
import {
  resolveBehaviorSource,
  validSourceSeconds,
  type CallSourceTarget,
} from "@/lib/coaching/source-navigation";
import type { Evidence, ReportCitation } from "@/lib/coaching/types";
import { CallRecording } from "./CallRecording";
import { FigmaCallTimeline } from "./FigmaCallTimeline";

export function ReportCallEvidence({
  citation,
  organizationId,
  repId,
  onOpenCall,
}: {
  citation: ReportCitation;
  organizationId: string | null;
  repId: string;
  onOpenCall: (callId: string, seconds: number | null, citation: ReportCitation) => void;
}) {
  const [open, setOpen] = useState(false);
  const at = reportCitationSeconds(citation);
  return (
    <>
      <div className="page30-evidence">
        <div className="page30-evidence-heading">
          <span className="page30-label">From the call</span>
          {at !== null && <span className="page30-chip font-mono">{citation.at}</span>}
        </div>
        <dl className="page30-quote">
          {citation.customer_text && (
            <div>
              <dt>Buyer</dt>
              <dd>{citation.customer_text}</dd>
            </div>
          )}
          {citation.rep_text && (
            <div>
              <dt>Rep</dt>
              <dd>{citation.rep_text}</dd>
            </div>
          )}
        </dl>
        {citation.why_it_matters && (
          <p className="page30-interpretation">
            <span aria-hidden="true">◇</span> Bylda’s interpretation · {citation.why_it_matters}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            className="figma-button page30-source-link"
            onClick={() => onOpenCall(citation.call_id, at, citation)}
          >
            {at === null ? "Open call review" : `Open call at ${citation.at}`}{" "}
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      {organizationId && (
        <details
          className="page30-evidence-details"
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary>
            <ChevronDown size={15} aria-hidden="true" /> Full behavior timeline
          </summary>
          {open && (
            <InlineCall
              organizationId={organizationId}
              repId={repId}
              citation={citation}
              initialSeconds={at}
            />
          )}
        </details>
      )}
    </>
  );
}

function InlineCall({
  organizationId,
  repId,
  citation,
  initialSeconds,
}: {
  organizationId: string;
  repId: string;
  citation: ReportCitation;
  initialSeconds: number | null;
}) {
  const callQuery = useQuery(coachingCallQuery(organizationId, citation.call_id));
  const call = callQuery.data?.rep_id === repId ? callQuery.data : null;
  const savedSource = citation.behavior_source;
  const runId = savedSource?.run_id ?? call?.insight?.vertical_insights?.behavior_analysis?.run_id;
  const callId = call?.id;
  const turnId = savedSource?.turn_id;
  const target = useMemo<CallSourceTarget | null>(
    () =>
      callId && typeof runId === "string" && runId
        ? {
            organizationId,
            repId,
            callId,
            startSeconds: initialSeconds,
            source: {
              kind: "behavior",
              runId,
              ...(turnId !== undefined ? { turnId } : {}),
            },
          }
        : null,
    [callId, runId, turnId, initialSeconds, organizationId, repId],
  );
  const source = useQuery(behaviorRunSourceQuery(target));
  const resolution = useMemo(
    () => (target && source.data ? resolveBehaviorSource(target, source.data) : null),
    [target, source.data],
  );
  const snapshot = !source.error && resolution?.status === "available" ? source.data : null;
  const [position, setPosition] = useState(initialSeconds);
  const [seek, setSeek] = useState({ at: initialSeconds, request: 0 });
  const [selectedTurn, setSelectedTurn] = useState<number | null>(savedSource?.turn_id ?? null);
  const [occurrence, setOccurrence] = useState<string | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const turns = snapshot && resolution?.status === "available" ? resolution.turns : [];
  const lines = snapshot
    ? turns.map((turn) => ({
        key: turn.turn_id,
        turnId: turn.turn_id,
        at: turn.start_s,
        speaker: turn.speaker === "customer" ? "Buyer" : turn.speaker,
        text: turn.text,
      }))
    : !savedSource && call
      ? segmentLines(call).map((line) => ({
          key: line.key,
          turnId: null,
          at: secondsFromCitation(line.time),
          speaker: line.speaker,
          text: line.text,
        }))
      : [];
  const active =
    selectedTurn !== null
      ? lines.find((line) => line.turnId === selectedTurn)
      : position === null
        ? undefined
        : lines.reduce<(typeof lines)[number] | undefined>((nearest, line) => {
            if (line.at === null || line.at > position) return nearest;
            return !nearest || line.at >= (nearest.at ?? -1) ? line : nearest;
          }, undefined);
  const activeKey = active?.key;
  useEffect(() => {
    if (activeKey === undefined) return;
    const container = transcript.current;
    const row = container?.querySelector('[aria-current="true"]');
    if (!container || !row) return;
    const bounds = container.getBoundingClientRect();
    const line = row.getBoundingClientRect();
    if (line.top < bounds.top) container.scrollTop -= bounds.top - line.top;
    if (line.bottom > bounds.bottom) container.scrollTop += line.bottom - bounds.bottom;
  }, [activeKey]);

  if (callQuery.isPending) return <p role="status">Loading call evidence…</p>;
  if (callQuery.error)
    return (
      <p role="alert">
        The source call could not load.{" "}
        <button className="underline" onClick={() => void callQuery.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!call) return <p role="status">The source call is unavailable for this report.</p>;

  function select(at: number | null, turnId: number | null, key: string | null) {
    setSelectedTurn(turnId);
    setOccurrence(key);
    if (at !== null) {
      setPosition(at);
      setSeek((previous) => ({ at, request: previous.request + 1 }));
    }
  }
  const event = snapshot?.analysis.events.find((item) => item.occurrence_key === occurrence);
  return (
    <div className="page30-inline-call">
      <header>
        <h4>{call.contactName}</h4>
        {validSourceSeconds(call.duration) && (
          <span className="font-mono">{formatDuration(call.duration)}</span>
        )}
      </header>
      {!savedSource && target && (
        <p className="page30-muted">
          Currently available call analysis. The saved excerpt appears above.
        </p>
      )}
      {(call.audio_path || call.recording_url) && (
        <CallRecording
          path={call.audio_path}
          recordingUrl={call.recording_url}
          seekSeconds={seek.at}
          seekRequest={seek.request}
          playOnSeek={false}
          onPositionChange={(at) => {
            setSelectedTurn(null);
            setPosition(at);
          }}
        />
      )}
      {target && source.isPending ? (
        <p role="status">Loading the retained behavior timeline…</p>
      ) : source.error ? (
        <p role="alert">
          The behavior timeline could not load.{" "}
          <button className="underline" onClick={() => void source.refetch()}>
            Retry
          </button>
        </p>
      ) : target && !snapshot ? (
        <p role="status">The retained behavior timeline is unavailable.</p>
      ) : !snapshot ? (
        <p role="status">No retained behavior timeline is available for this call.</p>
      ) : (
        <FigmaCallTimeline
          analysis={snapshot?.analysis ?? null}
          duration={call.duration}
          turns={turns}
          structuredTurns={snapshot?.source_snapshot.structured_turns ?? null}
          position={position}
          onSelect={(e: Evidence, key) => select(e.start_s, e.turn_id, key)}
        />
      )}
      {event && (
        <div className="page30-evidence" aria-live="polite">
          <p>
            <strong>Observed behavior</strong> · {event.rep_behavior}
          </p>
          {event.buyer_reaction && (
            <p>
              <strong>Buyer response</strong> · {event.buyer_reaction}
            </p>
          )}
          {event.interpretation && (
            <p className="page30-interpretation">
              ◇ Bylda’s interpretation · {event.interpretation}
            </p>
          )}
        </div>
      )}
      {lines.length > 0 && (
        <section aria-label="Call transcript">
          <h4>Transcript</h4>
          <div
            ref={transcript}
            className="page30-transcript"
            tabIndex={0}
            aria-label="Transcript turns"
          >
            {lines.map((line) => (
              <div key={line.key} aria-current={active?.key === line.key ? true : undefined}>
                {line.at === null ? (
                  <span>—</span>
                ) : (
                  <button type="button" onClick={() => select(line.at, line.turnId, null)}>
                    {timeLabel(line.at)}
                  </button>
                )}
                <strong>{line.speaker}</strong>
                <p>{line.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {!call.audio_path && !call.recording_url && (
        <p className="page30-muted">Recording unavailable.</p>
      )}
      {lines.length === 0 && !source.isFetching && (
        <p className="page30-muted">Transcript unavailable.</p>
      )}
    </div>
  );
}
