import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  cn,
  DataBoundary,
  Icon,
  StateEmpty,
  StateError,
  SystemState,
  systemStates,
  Tag,
  ConfidenceMeter,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useCallReview,
  useCalls,
  useViewer,
  useReanalyzeCall,
  type CallReview,
  type Viewer,
} from "@/lib/data";
import {
  canCoach,
  clampTime,
  demoTiming,
  demoAnnotations,
  presentation,
  timeLabel,
  type ReviewPresentation,
} from "./reviewModel";
import overviewTrack from "./assets/C4-Frame.svg";
import analysisTrack from "./assets/C5-Frame.svg";
import coachingTrack from "./assets/C6-Frame.svg";

import { panelClass } from "./reviewStyle";
export type ReviewTab = "overview" | "transcript" | "analysis" | "coaching";
export type ReviewProps = {
  review: CallReview;
  model: ReviewPresentation;
  viewer: Viewer;
  time: number;
  seek: (s: number) => void;
  notice: (message: string) => void;
};
export function ReviewScreen({
  tab,
  children,
}: {
  tab: ReviewTab;
  children: (props: ReviewProps) => ReactNode;
}) {
  const { callId } = useParams({ strict: false });
  const query = useCallReview(callId ?? "");
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {() => <DataView query={query} tab={tab} children={children} />}
    </DataBoundary>
  );
}
function DataView({
  query,
  tab,
  children,
}: {
  query: ReturnType<typeof useCallReview>;
  tab: ReviewTab;
  children: (props: ReviewProps) => ReactNode;
}) {
  const viewer = useViewer();
  return (
    <DataBoundary
      query={query}
      empty={<MissingCall />}
      error={(e) =>
        e instanceof ForbiddenForRoleError ? (
          <SystemState
            {...systemStates.permissionDenied()}
            title="You don’t have access to this call."
            body="Reps can review only their own calls. Ask your manager if you need help."
          />
        ) : (
          <StateError
            body={e instanceof Error ? e.message : "Unable to load this call."}
            onRetry={() => void query.refetch()}
          />
        )
      }
    >
      {(review) =>
        viewer.data && review ? (
          <ReviewContent
            key={review.call.id + tab}
            review={review}
            viewer={viewer.data}
            tab={tab}
            children={children}
          />
        ) : null
      }
    </DataBoundary>
  );
}
function MissingCall() {
  const calls = useCalls();
  return (
    <div>
      <SystemState
        {...systemStates.callDeleted()}
        eyebrow="CALL · UNAVAILABLE"
        title="This call isn’t available."
        body="It may have been removed or you may no longer have access."
        tag={undefined}
      />
      <DataBoundary query={calls}>
        {(rows) => (
          <nav aria-label="Available calls" className="flex flex-col gap-3 p-6">
            {rows.map((call) => (
              <Link
                key={call.id}
                to="/app/calls/$callId"
                params={{ callId: call.id }}
                className="type-ui-small hover:underline"
              >
                {call.account.name} · {call.repName}
              </Link>
            ))}
          </nav>
        )}
      </DataBoundary>
    </div>
  );
}
function ReviewContent({
  review,
  viewer,
  tab,
  children,
}: {
  review: CallReview;
  viewer: Viewer;
  tab: ReviewTab;
  children: (props: ReviewProps) => ReactNode;
}) {
  const model = presentation(review, viewer.role === "rep");
  const duration = review.call.durationSec;
  const [time, setTime] = useState(
    model.demo ? demoTiming.selected : (review.moments[0]?.tSeconds ?? 0),
  );
  const [message, setMessage] = useState("");
  const seek = (s: number) => setTime(clampTime(s, duration));
  useEffect(() => {
    const read = () => {
      const m = window.location.hash.match(/^#t-(\d+)$/);
      if (m) setTime(clampTime(Number(m[1]), duration));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [duration]);
  const props = { review, viewer, model, time, seek, notice: setMessage };
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        tab === "transcript" ? "gap-[18px] px-8 py-6" : "gap-5 px-9 py-7",
      )}
    >
      <ReviewHeader {...props} tab={tab} />
      {message && (
        <div
          role="status"
          className="type-ui-small flex items-center justify-between gap-3 rounded-by-control border border-by-border-engraved bg-by-surface-inset p-3"
        >
          <span>{message}</span>
          <Button variant="ghost" size="sm" onClick={() => setMessage("")}>
            Dismiss
          </Button>
        </div>
      )}
      {review.call.status === "processing" ? (
        <SystemState
          {...systemStates.analysisProcessing()}
          title="This call is still processing."
          body="Transcript and analysis will appear when processing finishes."
        />
      ) : review.call.status === "failed" ? (
        <ReviewRetry callId={review.call.id} />
      ) : (
        children(props)
      )}
    </div>
  );
}
function ReviewHeader({
  review,
  model,
  viewer,
  tab,
  notice,
}: {
  review: CallReview;
  model: ReviewPresentation;
  viewer: Viewer;
  tab: ReviewTab;
  notice: (s: string) => void;
}) {
  const calls = useCalls();
  const rows = calls.data ?? [];
  const position = rows.findIndex((c) => c.id === review.call.id);
  const date = new Date(review.call.startedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const stage = review.call.stageAtCall ?? review.call.type.replaceAll("_", " ");
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notice("Call link copied. Workspace permissions still apply.");
    } catch {
      notice("Copy this page’s URL to share it. Workspace permissions still apply.");
    }
  };
  return (
    <header className="flex min-w-0 flex-col gap-5">
      {tab === "transcript" && (
        <div className="type-mono-micro flex flex-wrap items-center gap-3 text-by-text-tertiary">
          <Link to="/app/calls">CALLS</Link>
          <span>/</span>
          <span>NEEDS REVIEW</span>
          <span>/</span>
          <Link
            to="/app/calls/$callId"
            params={{ callId: review.call.id }}
            className="text-by-text-primary"
          >
            {review.call.account.name.toUpperCase()}
          </Link>
          <div className="ml-auto flex items-center gap-4">
            {position > 0 && (
              <Link to="/app/calls/$callId/transcript" params={{ callId: rows[position - 1].id }}>
                ← PREV
              </Link>
            )}
            <span>{position >= 0 ? `${position + 1} of ${rows.length}` : ""}</span>
            {position >= 0 && position < rows.length - 1 && (
              <Link to="/app/calls/$callId/transcript" params={{ callId: rows[position + 1].id }}>
                NEXT →
              </Link>
            )}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h1 className="type-editorial-h1 truncate" title={model.title}>
            {model.title}
          </h1>
          <div
            className={cn(
              "mt-1.5 text-by-text-secondary",
              tab === "transcript"
                ? "type-mono-data flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
                : "type-ui-small",
            )}
          >
            {tab === "transcript" ? (
              <>
                <span className="type-ui-small flex items-center gap-1.5 text-by-text-primary">
                  <Avatar name={review.call.repName} size={20} />
                  {review.call.repName}
                </span>
                <span>
                  {date} ·{" "}
                  {new Date(review.call.startedAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>{timeLabel(review.call.durationSec)}</span>
                <span>{stage} call</span>
                <span>{model.contacts.join(", ")}</span>
                <span>
                  Opp: {review.call.account.name}
                  {model.opportunity ? ` · ${model.opportunity}` : ""} · {stage}
                </span>
                <Tag tone={review.call.outcome === "no_decision" ? "attention" : "neutral"}>
                  {review.call.outcome?.replaceAll("_", " ") ?? "Pending"}
                </Tag>
              </>
            ) : (
              `${date} · ${Math.round(review.call.durationSec / 60)} min · ${review.call.repName} · ${model.contacts.join(", ")}${model.opportunity ? ` · Opp ${model.opportunity}` : ""} · ${stage}`
            )}
          </div>
        </div>
        {tab !== "transcript" && (
          <>
            <div className="flex -space-x-1.5">
              {[review.call.repName, ...model.contacts].map((name) => (
                <Avatar key={name} name={name.replace(/ \(.*/, "")} size={28} />
              ))}
            </div>
            <Tag tone={review.call.outcome === "no_decision" ? "attention" : "neutral"}>
              {review.call.outcome?.replaceAll("_", " ") ?? "Pending"}
            </Tag>
          </>
        )}
        <Button variant={tab === "transcript" ? "ghost" : "secondary"} onClick={() => void share()}>
          Share
        </Button>
        {tab === "transcript" && (
          <Button variant="secondary" asChild>
            <Link to="/app/calls/$callId/coaching" params={{ callId: review.call.id }} hash="note">
              Add note
            </Link>
          </Button>
        )}
        {canCoach(viewer.role) && (
          <Button asChild>
            <Link to="/app/coaching/assign">Assign coaching</Link>
          </Button>
        )}
      </div>
      {tab !== "transcript" && <ReviewTabs callId={review.call.id} active={tab} />}
    </header>
  );
}
export function ReviewTabs({ callId, active }: { callId: string; active: ReviewTab }) {
  const tabs = [
    { key: "overview", label: "Overview", to: "/app/calls/$callId" },
    { key: "transcript", label: "Transcript", to: "/app/calls/$callId/transcript" },
    { key: "analysis", label: "Analysis", to: "/app/calls/$callId/analysis" },
    { key: "coaching", label: "Coaching", to: "/app/calls/$callId/coaching" },
  ] as const;
  return (
    <nav aria-label="Call review" className="flex gap-[22px] border-b border-by-border-engraved">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          params={{ callId }}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "type-ui-body py-[9px]",
            active === t.key
              ? "border-b-2 border-by-text-primary font-medium"
              : "text-by-text-secondary",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
export function ReviewRetry({ callId }: { callId: string }) {
  const retry = useReanalyzeCall();
  return (
    <div className="flex flex-col gap-3">
      <StateError
        title="This call couldn’t be analyzed."
        body="Your recording is safe. Try the analysis again."
        onRetry={() => retry.mutate(callId)}
      />
      {retry.isPending && (
        <p role="status" className="type-ui-small">
          Requesting analysis…
        </p>
      )}
      {retry.isSuccess && (
        <p role="status" className="type-ui-small">
          Analysis requested. Refresh the call when it’s ready.
        </p>
      )}
      {retry.isError && (
        <p role="alert" className="type-ui-small text-by-signal-regress">
          {retry.error.message}
        </p>
      )}
    </div>
  );
}
export function ReviewSummary({
  review,
  model,
  detailed = false,
}: {
  review: CallReview;
  model: ReviewPresentation;
  detailed?: boolean;
}) {
  return (
    <section className={cn(panelClass, "flex flex-wrap gap-5 px-5 py-4")}>
      <div className="min-w-0 flex-1">
        <h2 className="type-mono-micro mb-1.5 text-by-text-tertiary">BYLDA SUMMARY</h2>
        <p className="type-editorial-insight">{model.summary ?? "No summary available yet."}</p>
        {model.demo && (
          <ConfidenceMeter
            level="high"
            {...demoAnnotations.summaryConfidence}
            className="mt-2 flex-wrap"
          />
        )}
      </div>
      {model.demo && detailed && (
        <dl className="flex w-[220px] shrink-0 flex-col gap-2">
          {[
            [
              "Talk / listen",
              review.analysis.talkRatio === null
                ? "Unavailable"
                : `${Math.round(review.analysis.talkRatio * 100)} / ${Math.round((1 - review.analysis.talkRatio) * 100)}`,
            ],
            [
              "Interruptions",
              String(review.events.filter((e) => e.type === "interruption").length),
            ],
            ["Questions asked", String(review.events.filter((e) => e.type === "question").length)],
            ["Next step", review.analysis.nextSteps.join(" · ") || "None set"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="type-ui-small text-by-text-secondary">{label}</dt>
              <dd className="type-mono-data text-right">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
export function Player({
  review,
  model,
  time,
  seek,
  notice,
  tab = "overview",
  compact = true,
}: {
  review: CallReview;
  model: ReviewPresentation;
  time: number;
  seek: (s: number) => void;
  notice: (s: string) => void;
  tab?: ReviewTab;
  compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const duration = review.call.durationSec;
  useEffect(() => {
    if (audio.current && Math.abs(audio.current.currentTime - time) > 1)
      audio.current.currentTime = time;
  }, [time]);
  const toggle = async () => {
    if (!audio.current) {
      notice("No recording is available for playback. You can still inspect timestamped evidence.");
      return;
    }
    try {
      if (audio.current.paused) await audio.current.play();
      else audio.current.pause();
    } catch {
      notice("The recording couldn’t be played. Please try again.");
    }
  };
  const track =
    tab === "coaching" ? coachingTrack : tab === "analysis" ? analysisTrack : overviewTrack;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-3.5",
        compact && `${panelClass} px-4 py-3`,
      )}
    >
      {review.call.recordingUrl && (
        <audio
          ref={audio}
          src={review.call.recordingUrl}
          preload="metadata"
          onTimeUpdate={(e) => seek(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() =>
            notice("The recording is unavailable. Transcript and analysis are still accessible.")
          }
        />
      )}
      <button
        aria-label={playing ? "Pause recording" : "Play recording"}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-by-pill bg-by-surface-control-dark text-by-text-on-control"
        onClick={() => void toggle()}
      >
        {playing ? <span aria-hidden>Ⅱ</span> : <Icon name="play" size={13} />}
      </button>
      <span className="type-mono-data" data-testid="playback-time">
        {timeLabel(time)} / {timeLabel(duration)}
      </span>
      {compact && (
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ height: 24 }}>
          {model.demo ? (
            <img src={track} alt="Call event timeline" className="max-w-none" />
          ) : (
            <div className="absolute inset-x-0 top-[11px] h-[3px] bg-by-border-engraved" />
          )}
          <input
            aria-label="Seek recording"
            type="range"
            min={0}
            max={duration}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
          />
        </div>
      )}
      <button
        className="type-mono-data text-by-text-secondary"
        aria-label="Playback speed"
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >
        {speed}×
      </button>
      <button
        className="type-mono-data text-by-text-secondary"
        aria-label="Back 10 seconds"
        onClick={() => seek(time - 10)}
      >
        −10s
      </button>
      <button
        className="type-mono-data text-by-text-secondary"
        aria-label="Forward 10 seconds"
        onClick={() => seek(time + 10)}
      >
        +10s
      </button>
      {!compact && (
        <span className="type-mono-micro ml-auto flex flex-wrap gap-3">
          <span className="text-by-signal-attention">◆ objection</span>
          <span className="text-by-signal-regress">| interruption</span>
          <span>▬ monologue</span>
          <span className="text-by-signal-info">• question</span>
          <span className="text-by-signal-improve">✓ positive</span>
        </span>
      )}
    </div>
  );
}
export function ReviewEmpty({ title }: { title: string }) {
  return <StateEmpty title={title} body="When there’s evidence, it will appear here." />;
}
