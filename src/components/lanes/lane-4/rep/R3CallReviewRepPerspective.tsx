import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ConfidenceMeter,
  ContextPanel,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  StateLoading,
  SystemState,
  cn,
  systemStates,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCallReview,
  useMyCoaching,
  useReanalyzeCall,
  useViewer,
  type BehavioralEvent,
  type CallReview,
  type CoachingFocus,
  type TranscriptSegment,
  type Viewer,
} from "@/lib/data";
import { demoCallRead, demoPersonName } from "./repDemo";
import { CALL_TYPE_LABEL, OUTCOME_LABEL, callDate, clock, firstName } from "./repFormat";

/**
 * R3 · Call Review — Rep perspective
 * Figma 32:334 (page 1:7) · Lane 4 — Dravin · route /app/rep/calls/$callId
 * Hooks: useCallReview, useViewer (+ useMyCoaching for this call's coach notes)
 *
 * One moment, the coach's note on it, and what to try next. A rep may open only their own
 * call — the data layer refuses a peer's call (FORBIDDEN_FOR_ROLE → Y9).
 */

/** The excerpt around the moment that matters. */
const MOMENT_WINDOW_SEC = 90;
/** Bars in the call strip. */
const STRIP_BARS = 69; // Figma 32:334 strip: 69 bars, 6px wide, 3px gap

export function R3CallReviewRepPerspective() {
  const { callId = "" } = useParams({ strict: false });
  const review = useCallReview(callId);
  const viewer = useViewer();
  const navigate = useNavigate();
  const back = () => void navigate({ to: "/app/calls/mine" });

  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">
      <DataBoundary query={viewer} loading={<ReviewSkeleton />}>
        {(me) => (
          <DataBoundary
            query={review}
            loading={<ReviewSkeleton />}
            error={(e) =>
              e instanceof ForbiddenForRoleError ? (
                <SystemState
                  {...systemStates.permissionDenied({ managerFirstName: "your manager" })}
                  title="This isn’t your call."
                  actions={[{ label: "Back to my calls", variant: "ghost", onClick: back }]}
                />
              ) : (
                <StateError
                  eyebrow="CALL REVIEW"
                  body="Bylda couldn’t load this call. Try again in a moment."
                  onRetry={() => void review.refetch()}
                />
              )
            }
            empty={
              <SystemState
                {...systemStates.callDeleted({ onBack: back })}
                eyebrow="CALL · UNAVAILABLE"
                title="This call isn’t available."
                body="It may have been removed by an admin, or the link is out of date."
              />
            }
          >
            {(data) => (data ? <Review review={data} viewer={me} /> : null)}
          </DataBoundary>
        )}
      </DataBoundary>
    </div>
  );
}

function Review({ review, viewer }: { review: CallReview; viewer: Viewer }) {
  const { call } = review;
  const read = demoCallRead(call.id);
  const reanalyze = useReanalyzeCall();
  const [reviewed, setReviewed] = useState(false);
  const isMine = call.repId === viewer.id;
  const participants = [
    call.contactName
      ? read?.roles[call.contactName]
        ? `${call.contactName} (${read.roles[call.contactName]})`
        : call.contactName
      : null,
    ...(read?.extraParticipants ?? []),
  ].filter(Boolean);
  const meta = [
    callDate(call.startedAt),
    clock(call.durationSec),
    participants.join(", ") || null,
    call.outcome ? OUTCOME_LABEL[call.outcome] : null,
  ].filter(Boolean);

  return (
    <>
      <nav aria-label="Breadcrumb" className="type-mono-micro flex gap-2 text-by-text-tertiary">
        <Link to="/app/calls/mine" className="hover:text-by-text-primary">
          {isMine ? "MY CALLS" : "CALLS"}
        </Link>
        <span aria-hidden>/</span>
        <span>{call.account.name.toUpperCase()}</span>
      </nav>

      <header className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="type-editorial-h1 text-by-text-primary">
            {call.account.name} — {read?.title ?? CALL_TYPE_LABEL[call.type]}
          </h1>
          <p className="type-ui-small text-by-text-secondary">{meta.join(" · ")}</p>
        </div>
        {isMine && call.status === "ready" ? (
          <Button
            variant={reviewed ? "secondary" : "primary"}
            icon={reviewed ? "check" : undefined}
            onClick={() => setReviewed((r) => !r)}
            aria-pressed={reviewed}
          >
            {reviewed ? "Reviewed" : "Mark as reviewed"}
          </Button>
        ) : null}
      </header>

      {call.status === "processing" ? (
        <StateLoading
          variant="progress"
          eyebrow="CALL · ANALYSIS PROCESSING"
          title="Bylda is still analyzing this call."
          body="The moment that matters and your coach’s read show up here when it’s done."
        />
      ) : call.status === "failed" ? (
        <SystemState
          {...systemStates.analysisFailed({
            reason: review.analysis.summary ?? undefined,
            onRetry: () => reanalyze.mutate(call.id),
          })}
        />
      ) : call.status === "partial" ? (
        <SystemState
          {...systemStates.missingTranscript({ durationLabel: `${call.durationSec} seconds` })}
        />
      ) : (
        <ReadyReview review={review} viewer={viewer} />
      )}
    </>
  );
}

function ReadyReview({ review, viewer }: { review: CallReview; viewer: Viewer }) {
  const moment = pickMoment(review);
  const excerpt = moment
    ? review.transcript.filter(
        (s) =>
          s.tEnd >= moment.tSeconds - MOMENT_WINDOW_SEC / 2 &&
          s.tStart <= moment.tSeconds + MOMENT_WINDOW_SEC / 2,
      )
    : review.transcript.slice(0, 3);
  const speaker = speakerLabeler(review, viewer);

  return (
    <>
      <CallStrip review={review} moment={moment} />

      {moment ? (
        <p className="type-mono-data text-by-text-primary">
          ▶ {moment.timestamp} — the moment that matters · {MOMENT_WINDOW_SEC} seconds
        </p>
      ) : null}

      {excerpt.length ? (
        <section
          aria-label="Transcript excerpt"
          className="flex flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-3"
        >
          {excerpt.map((s) => (
            <TranscriptLine
              key={s.id}
              segment={s}
              label={speaker(s)}
              tone={segmentTone(s, review.events)}
            />
          ))}
        </section>
      ) : (
        <SystemState {...systemStates.missingTranscript()} />
      )}

      <CoachNotes callId={review.call.id} />

      <ContextPanel>
        <CallRead review={review} />
      </ContextPanel>
    </>
  );
}

/** The data layer's top moment, else the first moment your coach pinned on this call. */
type Moment = CallReview["moments"][number];
function pickMoment(review: CallReview): Moment | null {
  return review.moments.find((m) => m.tone === "regress") ?? review.moments[0] ?? null;
}

function speakerLabeler(review: CallReview, viewer: Viewer) {
  const read = demoCallRead(review.call.id);
  return (s: TranscriptSegment) => {
    if (s.speaker === "rep") {
      return review.call.repId === viewer.id ? "YOU" : firstName(s.speakerName).toUpperCase();
    }
    const role = read?.roles[s.speakerName];
    return `${firstName(s.speakerName)}${role ? ` · ${role}` : ""}`.toUpperCase();
  };
}

const overlaps = (e: BehavioralEvent, s: { tStart: number; tEnd: number }) =>
  e.tStart < s.tEnd && e.tEnd > s.tStart;

/** Rep lost the floor → regress. Prospect objecting → attention. Direction only (§3). */
function segmentTone(s: TranscriptSegment, events: BehavioralEvent[]) {
  const hits = events.filter((e) => overlaps(e, s));
  if (s.speaker === "rep" && hits.some((e) => e.type === "interruption")) return "regress";
  if (s.speaker === "prospect" && hits.some((e) => e.type === "objection")) return "attention";
  return null;
}

function TranscriptLine({
  segment,
  label,
  tone,
}: {
  segment: TranscriptSegment;
  label: string;
  tone: "regress" | "attention" | null;
}) {
  return (
    <div
      id={`t-${segment.tStart}`}
      className={cn(
        "flex items-start gap-3 p-2",
        tone === "regress" && "bg-by-signal-regress-bg",
        tone === "attention" && "bg-by-signal-attention-bg",
      )}
    >
      <p className="type-mono-micro w-20 shrink-0 text-by-text-secondary">
        {clock(segment.tStart)}
        <br />
        {label}
      </p>
      <p className="type-ui-body min-w-0 flex-1 text-by-text-primary">{segment.text}</p>
    </div>
  );
}

/**
 * The whole call as a strip of bars. A bar is coloured only where a behavioral event
 * happened (objection → attention, interruption → regress). The data layer carries no
 * amplitude, so quiet bars use Figma's fixed 8 / 15px rhythm — not a waveform.
 */
function CallStrip({ review, moment }: { review: CallReview; moment: Moment | null }) {
  const duration = Math.max(review.call.durationSec, 1);
  const step = duration / STRIP_BARS;
  const bars = Array.from({ length: STRIP_BARS }, (_, i) => {
    const span = { tStart: i * step, tEnd: (i + 1) * step };
    const hits = review.events.filter((e) => overlaps(e, span));
    const inMoment =
      moment !== null &&
      span.tEnd >= moment.tSeconds - MOMENT_WINDOW_SEC / 2 &&
      span.tStart <= moment.tSeconds + MOMENT_WINDOW_SEC / 2;
    const tone = hits.some((e) => e.type === "interruption" || e.type === "control_shift")
      ? "regress"
      : hits.some((e) => e.type === "objection")
        ? "attention"
        : inMoment && (moment.tone === "regress" || moment.tone === "attention")
          ? moment.tone
          : null;
    return { i, tone };
  });
  return (
    <div
      role="img"
      aria-label={`Call timeline, ${clock(duration)}${moment ? `, key moment at ${moment.timestamp}` : ""}`}
      className="flex h-[58px] items-end gap-[3px] rounded-by-card border border-by-border-engraved bg-by-surface-raised px-4 py-3.5"
    >
      {bars.map((b) => (
        <span
          key={b.i}
          className={cn(
            "flex-1",
            b.tone === "regress" && "h-full bg-by-signal-regress",
            b.tone === "attention" && "h-full bg-by-signal-attention",
            b.tone === null && (b.i % 2 ? "h-[15px]" : "h-2"),
            b.tone === null && "bg-by-border-control",
          )}
        />
      ))}
    </div>
  );
}

/** Your coach's note(s) pinned to this call — from your own coaching foci. */
function CoachNotes({ callId }: { callId: string }) {
  const foci = useMyCoaching();
  return (
    <section aria-label="Coach notes on this call" className="flex flex-col gap-3">
      <p className="type-ui-label text-by-text-primary">COACH NOTES ON THIS CALL</p>
      <DataBoundary
        query={foci}
        loading={<SkeletonBlock height={120} />}
        error={() => (
          <StateError body="Couldn’t load coach notes." onRetry={() => void foci.refetch()} />
        )}
        empty={<NoNotes />}
      >
        {(rows) => {
          const here = rows.filter((f) => f.evidence.some((e) => e.callId === callId));
          return here.length ? (
            here.map((f) => <CoachNote key={f.id} focus={f} callId={callId} />)
          ) : (
            <NoNotes />
          );
        }}
      </DataBoundary>
    </section>
  );
}

function NoNotes() {
  return (
    <p className="type-ui-small rounded-by-card border border-by-border-engraved bg-by-surface-inset px-[18px] py-4 text-by-text-secondary">
      No coach notes on this call yet.
    </p>
  );
}

function CoachNote({ focus, callId }: { focus: CoachingFocus; callId: string }) {
  const coach = demoPersonName(focus.assignedById);
  const at = focus.evidence.find((e) => e.callId === callId);
  const [draft, setDraft] = useState("");
  const [held, setHeld] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) setHeld(true);
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-[18px] py-4">
      <div className="flex items-center gap-2">
        <Avatar name={coach ?? "Manager"} size={22} />
        <p className="type-mono-micro text-by-text-secondary">
          {coach ? firstName(coach) : "Your manager"}
          {at ? ` · at ${at.timestamp}` : ""}
        </p>
      </div>
      <p className="type-ui-small text-by-text-primary">{focus.note}</p>
      <form onSubmit={submit}>
        {/* GAP: no reply/comment mutation for coaching yet (LANE_REQUESTS.md #30) — the
            draft stays on this page and says so; nothing is sent. */}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setHeld(false);
          }}
          aria-label={`Reply to ${coach ? firstName(coach) : "your manager"}`}
          placeholder={`Reply to ${coach ? firstName(coach) : "your manager"}…`}
          className="type-ui-small w-full rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-[9px] text-by-text-primary placeholder:text-by-text-tertiary focus:border-by-focus-ring focus:outline-none"
        />
      </form>
      {held ? (
        <p role="status" className="type-ui-small text-by-text-tertiary">
          Replies aren’t sent from here yet — your draft stays on this page.
        </p>
      ) : null}
    </div>
  );
}

function CallRead({ review }: { review: CallReview }) {
  const read = demoCallRead(review.call.id);
  const { analysis, events } = review;
  const interruptions = events.filter((e) => e.type === "interruption").length;
  const questions = events.filter((e) => e.type === "question").length;
  const stats: [string, string][] = [
    [
      "Talk / listen",
      analysis.talkRatio === null
        ? "—"
        : `${Math.round(analysis.talkRatio * 100)} / ${100 - Math.round(analysis.talkRatio * 100)}`,
    ],
    ["Interruptions", String(interruptions)],
    ["Questions", String(questions)],
    ["Next step", analysis.nextSteps[0] ?? "None set"],
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      {read ? (
        <>
          <PanelLabel>WHAT YOU DID WELL</PanelLabel>
          <p className="type-ui-small text-by-text-primary">{read.didWell}</p>
          <PanelLabel>WHERE YOU LOST THE CALL</PanelLabel>
          <p className="type-ui-small text-by-text-primary">{read.lostIt}</p>
          <PanelLabel>TRY THIS NEXT TIME</PanelLabel>
          <div className="flex flex-col gap-1.5 rounded-by-card bg-by-surface-rail px-4 py-3.5">
            <p className="type-editorial-insight text-by-text-on-dark">{read.tryThis.line}</p>
            <p className="type-ui-small text-by-text-on-dark-muted">{read.tryThis.then}</p>
          </div>
          <ConfidenceMeter level={read.confidence} sampleSize={1} sampleLabel={read.sampleLabel} />
        </>
      ) : analysis.summary || analysis.objections.length ? (
        <>
          <PanelLabel>WHAT BYLDA SAW</PanelLabel>
          {analysis.summary ? (
            <p className="type-ui-small text-by-text-primary">{analysis.summary}</p>
          ) : null}
          {analysis.objections.map((o) => (
            <p key={o.label + o.timestamp} className="type-ui-small text-by-text-secondary">
              {o.timestamp ? `${o.timestamp} · ` : ""}
              {o.label} — handled {o.handled === "unclear" ? "unclearly" : o.handled}
            </p>
          ))}
        </>
      ) : (
        <p className="type-ui-small text-by-text-secondary">
          No read on this call yet. Bylda adds one once analysis finishes.
        </p>
      )}

      <PanelLabel>THIS CALL</PanelLabel>
      <div className="flex flex-col">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start gap-2.5 border-b border-by-border-engraved py-2"
          >
            <p className="type-mono-micro w-[100px] shrink-0 text-by-text-tertiary">{label}</p>
            <p className="type-ui-small flex-1 text-by-text-primary">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: string }) {
  return <p className="type-ui-label text-by-text-primary">{children}</p>;
}

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <SkeletonBar width={200} height={10} />
      <SkeletonBar width={420} height={32} />
      <SkeletonBlock height={58} />
      <SkeletonBlock height={170} />
      <SkeletonBlock height={120} />
    </div>
  );
}
