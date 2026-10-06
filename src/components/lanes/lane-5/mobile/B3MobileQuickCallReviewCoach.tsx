import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Avatar, Button, EvidenceBlock, Tag, StateEmpty } from "@/components/bylda";
import {
  useCallReview,
  useViewer,
  useAssignCoaching,
  useBehaviors,
  mocksForced,
  type CallReview,
} from "@/lib/data";
import { LocalBoundary, LocalMobileFrame, LocalRestricted } from "./LocalMobile";
export function B3MobileQuickCallReviewCoach() {
  const { callId } = useParams({ strict: false }) as { callId: string };
  return (
    <LocalMobileFrame active="Calls">
      <LocalCall key={callId} callId={callId} />
    </LocalMobileFrame>
  );
}
function LocalCall({ callId }: { callId: string }) {
  const viewer = useViewer();
  return (
    <LocalBoundary query={viewer}>
      {(v) => <LocalReview callId={callId} viewer={v} />}
    </LocalBoundary>
  );
}
function LocalReview({ callId, viewer }: { callId: string; viewer: { id: string; role: string } }) {
  const query = useCallReview(callId);
  const [assign, setAssign] = useState(false);
  return (
    <LocalBoundary query={query} emptyTitle="Call not found.">
      {(review) => {
        if (!review) return <StateEmpty title="Call not found." />;
        if (viewer.role === "rep" && review.call.repId !== viewer.id) return <LocalRestricted />;
        const call = review.call;
        const canCoach = ["owner", "admin", "manager", "coach"].includes(viewer.role);
        return (
          <>
            <Link
              to={(viewer.role === "rep" ? "/app/calls/mine" : "/app/calls") as never}
              search={true}
              className="type-mono-micro text-by-text-tertiary"
            >
              ← CALLS
            </Link>
            <h1 className="type-editorial-h2">{call.account.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Avatar name={call.repName} size={22} />
              <p className="type-mono-data text-by-text-secondary">
                {call.repName} · {Math.floor(call.durationSec / 60)}:
                {String(call.durationSec % 60).padStart(2, "0")}
              </p>
              <Tag>{call.outcome?.replaceAll("_", " ") ?? call.status}</Tag>
            </div>
            <p className="type-ui-body min-h-[63px]">
              {review.analysis.summary ?? "Analysis isn’t available yet."}
            </p>
            {call.recordingUrl ? (
              <audio controls className="w-full" src={call.recordingUrl} preload="metadata" />
            ) : (
              <div className="min-h-[48px] rounded-by-control border border-by-border-engraved bg-by-surface-raised px-3.5 py-3">
                <p className="type-ui-small text-by-text-secondary">
                  Recording unavailable. Read the evidence below.
                </p>
              </div>
            )}
            {review.moments
              .filter((e) => e.callId === call.id)
              .map((e) => (
                <EvidenceBlock
                  className="min-h-[92px]"
                  key={e.callId + e.tSeconds}
                  evidence={{ timestamp: e.timestamp, speaker: e.speakerLabel, quote: e.quote }}
                />
              ))}
            {canCoach && (
              <Button className="w-full justify-start" onClick={() => setAssign(!assign)}>
                {assign ? "Cancel assignment" : `Assign coaching to ${call.repName.split(" ")[0]}`}
              </Button>
            )}
            {assign && canCoach && <LocalAssignment key={call.id} review={review} />}
            <Button variant="secondary" asChild className="w-full justify-start">
              <Link to="/app/calls/$callId/transcript" params={{ callId }} search={true}>
                Read transcript
              </Link>
            </Button>
          </>
        );
      }}
    </LocalBoundary>
  );
}
function LocalAssignment({ review }: { review: CallReview }) {
  const behaviors = useBehaviors();
  const mutation = useAssignCoaching();
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState("");
  const [calls, setCalls] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const chosen = behaviors.data?.find((b) => b.key === key && b.enabled);
  const valid =
    !!chosen &&
    note.trim().length > 0 &&
    target.trim() !== "" &&
    Number.isFinite(Number(target)) &&
    Number(target) >= 0 &&
    /^\d+$/.test(calls) &&
    Number(calls) > 0 &&
    Number.isSafeInteger(Number(calls));
  const input =
    "type-ui-small w-full rounded-by-control border border-by-border-control bg-by-surface-raised px-3 py-2";
  return (
    <LocalBoundary query={behaviors} emptyTitle="No enabled behaviors available.">
      {(list) => (
        <form
          className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-inset p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !confirmed)
              mutation.mutate(
                {
                  repId: review.call.repId,
                  behaviorKey: key,
                  note: note.trim(),
                  target: Number(target),
                  judgeAfterCalls: Number(calls),
                  evidence: review.moments
                    .filter((e) => e.callId === review.call.id)
                    .map(({ callId, timestamp, tSeconds, speaker, speakerLabel, quote }) => ({
                      callId,
                      timestamp,
                      tSeconds,
                      speaker,
                      speakerLabel,
                      quote,
                    })),
                },
                { onSuccess: () => setConfirmed(true) },
              );
          }}
        >
          <label className="type-ui-small">
            Behavior
            <select
              aria-label="Behavior"
              className={input}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={confirmed}
            >
              <option value="">Choose a behavior</option>
              {list
                .filter((b) => b.enabled)
                .map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          {chosen && <p className="type-ui-small text-by-text-secondary">{chosen.definition}</p>}
          <label className="type-ui-small">
            Coaching note
            <textarea
              aria-label="Coaching note"
              className={input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={confirmed}
            />
          </label>
          <label className="type-ui-small">
            Target in this behavior’s metric
            <input
              aria-label="Target"
              type="number"
              min="0"
              step="any"
              className={input}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={confirmed}
            />
          </label>
          <label className="type-ui-small">
            Judge after calls
            <input
              aria-label="Judge after calls"
              type="number"
              min="1"
              step="1"
              className={input}
              value={calls}
              onChange={(e) => setCalls(e.target.value)}
              disabled={confirmed}
            />
          </label>
          <Button disabled={!valid || mutation.isPending || confirmed} type="submit">
            {confirmed
              ? "Assigned"
              : mutation.isPending
                ? "Assigning…"
                : "Confirm coaching assignment"}
          </Button>
          {mutation.isError && (
            <p role="alert" className="type-ui-small">
              Couldn’t assign coaching. Try again.
            </p>
          )}
          {confirmed && (
            <p role="status" className="type-ui-small">
              Coaching assigned.{mocksForced() ? " Mock assignments are session-only." : ""}
            </p>
          )}
        </form>
      )}
    </LocalBoundary>
  );
}
