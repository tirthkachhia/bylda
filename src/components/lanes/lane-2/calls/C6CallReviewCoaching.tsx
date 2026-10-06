import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar, Button, ContextPanel, EvidenceBlock, cn } from "@/components/bylda";
import { useAssignCoaching } from "@/lib/data";
import { ReviewScreen, Player, ReviewEmpty, type ReviewProps } from "./ReviewLayout";
import { canCoach, timeLabel, type ReviewNote } from "./reviewModel";

export function C6CallReviewCoaching() {
  return <ReviewScreen tab="coaching">{(props) => <Coaching {...props} />}</ReviewScreen>;
}
function Coaching(props: ReviewProps) {
  const [draft, setDraft] = useState("");
  const [localNotes, setLocalNotes] = useState<ReviewNote[]>([]);
  const assign = useAssignCoaching();
  const focus = props.review.coaching[0];
  const notes = [...props.model.notes, ...localNotes];
  function addNote() {
    if (!draft.trim()) return;
    if (!props.model.demo) {
      props.notice("Saving call notes isn’t available yet. Your draft is still here.");
      return;
    }
    setLocalNotes((current) => [
      ...current,
      { id: crypto.randomUUID(), author: props.viewer.name, at: props.time, body: draft.trim() },
    ]);
    setDraft("");
    props.notice("Demo note added for this visit only. It has not been saved.");
  }
  return (
    <>
      <Player {...props} tab="coaching" />
      <h2 className="type-ui-title">Coach notes on this call</h2>
      {notes.length ? (
        notes.map((n) => (
          <article key={n.id} className={cn(panelClass, "flex items-start gap-3 px-3.5 py-3")}>
            <Avatar name={n.author} size={30} />
            <div className="min-w-0">
              <header className="flex flex-wrap items-center gap-2">
                <h3 className="type-ui-body-strong">{n.author}</h3>
                <button
                  className="type-mono-micro text-by-text-secondary"
                  onClick={() => props.seek(n.at)}
                >
                  at {timeLabel(n.at)}
                </button>
              </header>
              <p className="type-ui-small mt-[3px]">{n.body}</p>
            </div>
          </article>
        ))
      ) : (
        <ReviewEmpty title="No coach notes on this call yet." />
      )}
      <form
        id="note"
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addNote();
        }}
      >
        <label htmlFor="call-note" className="sr-only">
          Add a timestamped coach note
        </label>
        <input
          id="call-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add a note at ${timeLabel(props.time)}…`}
          className="type-ui-small w-full rounded-by-control border border-by-border-control bg-by-surface-raised px-3 py-2.5 placeholder:text-by-text-tertiary"
        />
        {draft && (
          <div className="flex items-center justify-between gap-3">
            <p className="type-ui-small text-by-text-secondary">
              {props.model.demo ? "Demo preview · not saved" : "Draft · saving unavailable"}
            </p>
            <Button variant="secondary" type="submit">
              Add note
            </Button>
          </div>
        )}
      </form>
      <ContextPanel>
        <div className="flex flex-col gap-[18px]">
          <h2 className="type-ui-label">COACHING FROM THIS CALL</h2>
          {focus ? (
            <section className="rounded-by-card bg-by-surface-control-dark px-4 py-3.5 text-by-text-on-control">
              <h3 className="type-mono-micro mb-1.5 text-by-text-on-dark-muted">ACTIVE FOCUS</h3>
              <p className="type-editorial-insight">{focus.note || focus.behaviorName}</p>
              <p className="type-ui-small mt-2.5 text-by-text-on-dark">
                {`Assigned ${new Date(focus.assignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${focus.status}`}
              </p>
            </section>
          ) : (
            <ReviewEmpty title="No active coaching focus." />
          )}
          <h3 className="type-ui-label">CLIPS SHARED</h3>
          {focus?.evidence
            .filter((e) => e.callId === props.review.call.id)
            .map((e, i) => (
              <button key={i} className="w-full text-left" onClick={() => props.seek(e.tSeconds)}>
                <EvidenceBlock
                  evidence={{ timestamp: e.timestamp, speaker: e.speakerLabel, quote: e.quote }}
                />
              </button>
            ))}
          <Button
            variant="secondary"
            onClick={() =>
              props.notice("Room clip sharing isn’t connected yet. No clip was posted.")
            }
          >
            Share clip to #objection-watch
          </Button>
          {canCoach(props.viewer.role) && focus && (
            <details className="type-ui-small">
              <summary className="cursor-pointer text-by-text-secondary">
                Assign a follow-up focus
              </summary>
              <form
                className="mt-3 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (focus.judgeAfter.calls === null) return;
                  assign.mutate({
                    repId: props.review.call.repId,
                    behaviorKey: focus.behaviorKey,
                    note: focus.note,
                    evidence: focus.evidence.filter((ev) => ev.callId === props.review.call.id),
                    target: focus.target,
                    judgeAfterCalls: focus.judgeAfter.calls!,
                  });
                }}
              >
                <p>Assign the same behavior, target and review window as the current focus.</p>
                {focus.judgeAfter.calls !== null ? (
                  <Button variant="secondary" type="submit" disabled={assign.isPending}>
                    Confirm assignment
                  </Button>
                ) : (
                  <p>
                    This focus has a date-based window. Use the assignment screen to choose a
                    call-based window.
                  </p>
                )}
                {assign.isSuccess && (
                  <p role="status">
                    {props.model.demo
                      ? "Demo focus assigned. No backend was changed."
                      : "Coaching focus assigned."}
                  </p>
                )}
                {assign.isError && <p role="alert">{assign.error.message}</p>}
              </form>
            </details>
          )}
          <Link to="/app/coaching" className="type-ui-small text-by-text-secondary hover:underline">
            View coaching
          </Link>
        </div>
      </ContextPanel>
    </>
  );
}
import { panelClass } from "./reviewStyle";
