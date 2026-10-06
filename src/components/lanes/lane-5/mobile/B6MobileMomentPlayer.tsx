import { parseMomentKey } from "./mobile-evidence";
import { useRef } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Button, StateEmpty } from "@/components/bylda";
import { useCallReview, useViewer, type CallReview } from "@/lib/data";
import {
  LocalRepOnly,
  LocalBoundary,
  LocalMobileFrame,
  LocalCard,
  LocalLabel,
  LocalRestricted,
} from "./LocalMobile";
export function B6MobileMomentPlayer() {
  const { momentId } = useParams({ strict: false }) as { momentId: string };
  const key = parseMomentKey(momentId);
  return (
    <LocalMobileFrame active="Calls">
      <LocalRepOnly>
        {key ? (
          <LocalMoment callId={key.callId} seconds={key.tSeconds} />
        ) : (
          <StateEmpty
            title="This moment link isn’t available."
            body="Open a timestamped moment from your brief or coaching focus."
          />
        )}
      </LocalRepOnly>
    </LocalMobileFrame>
  );
}
function LocalMoment({ callId, seconds }: { callId: string; seconds: number }) {
  const query = useCallReview(callId);
  const viewer = useViewer().data;
  return (
    <LocalBoundary query={query} emptyTitle="Call not found.">
      {(review) => {
        if (!review) return <StateEmpty title="Call not found." />;
        if (review.call.repId !== viewer?.id) return <LocalRestricted />;
        const moment =
          review.moments.find((m) => m.callId === callId && m.tSeconds === seconds) ??
          review.coaching
            .filter((f) => f.repId === viewer.id)
            .flatMap((f) => f.evidence)
            .find((e) => e.callId === callId && e.tSeconds === seconds);
        if (!moment) return <StateEmpty title="Moment not found." />;
        const focus = review.coaching.find(
          (f) =>
            f.repId === viewer.id &&
            f.evidence.some((e) => e.callId === callId && e.tSeconds === seconds),
        );
        return (
          <>
            <Link
              to="/m/calls/$callId"
              params={{ callId }}
              search={true}
              className="type-mono-micro text-by-text-tertiary"
            >
              ← {review.call.account.name.toUpperCase()}
            </Link>
            <h1 className="type-editorial-h2">The moment that mattered</h1>
            <LocalPlayer key={callId + seconds} review={review} seconds={seconds} />
            <LocalLabel>
              {moment.timestamp} · {moment.speakerLabel.toUpperCase()}
            </LocalLabel>
            <p className="type-editorial-quote">“{moment.quote}”</p>
            {review.transcript
              .filter((s) => s.tStart > seconds && s.tStart <= seconds + 30)
              .map((s) => (
                <div key={s.id} className="flex flex-col gap-2">
                  <LocalLabel>
                    {Math.floor(s.tStart / 60)}:{String(Math.floor(s.tStart % 60)).padStart(2, "0")}{" "}
                    · {s.speakerName}
                  </LocalLabel>
                  <p className="type-ui-body">{s.text}</p>
                </div>
              ))}
            {focus && (
              <LocalCard className="gap-1 px-3.5 py-3">
                <LocalLabel>YOUR COACHING FOCUS</LocalLabel>
                <p className="type-ui-body-strong">{focus.note}</p>
              </LocalCard>
            )}
          </>
        );
      }}
    </LocalBoundary>
  );
}
function LocalPlayer({ review, seconds }: { review: CallReview; seconds: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  return (
    <LocalCard dark className="min-h-[98px] gap-3">
      {review.call.recordingUrl ? (
        <>
          <audio
            ref={audio}
            controls
            preload="metadata"
            className="w-full"
            src={review.call.recordingUrl}
            onLoadedMetadata={() => {
              if (audio.current && Number.isFinite(audio.current.duration))
                audio.current.currentTime = Math.min(seconds, audio.current.duration);
            }}
          />
          <div className="flex gap-4">
            <Button
              variant="dark"
              onClick={() => {
                if (audio.current)
                  audio.current.currentTime = Math.max(0, audio.current.currentTime - 10);
              }}
            >
              −10 sec
            </Button>
            <Button
              variant="dark"
              onClick={() => {
                if (audio.current)
                  audio.current.currentTime = Math.min(
                    audio.current.duration || 0,
                    audio.current.currentTime + 10,
                  );
              }}
            >
              +10 sec
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="type-ui-title">Recording unavailable</p>
          <p className="type-ui-small text-by-text-on-dark-muted">
            Read the timestamped evidence below.
          </p>
        </>
      )}
    </LocalCard>
  );
}
