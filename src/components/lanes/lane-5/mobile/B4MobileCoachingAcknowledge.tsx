import { useParams, Link } from "@tanstack/react-router";
import { Button } from "@/components/bylda";
import { useMyCoaching, useViewer, useDmThreads, usePushRegistration } from "@/lib/data";
import {
  LocalRepOnly,
  LocalBoundary,
  LocalMobileFrame,
  LocalCard,
  LocalLabel,
  LocalEvidence,
  LocalAcknowledge,
  LocalRestricted,
} from "./LocalMobile";
export function B4MobileCoachingAcknowledge() {
  const { focusId } = useParams({ strict: false }) as { focusId: string };
  return (
    <LocalMobileFrame active="Coaching">
      <LocalRepOnly>
        <LocalFocus focusId={focusId} />
      </LocalRepOnly>
    </LocalMobileFrame>
  );
}
function LocalFocus({ focusId }: { focusId: string }) {
  const query = useMyCoaching();
  const viewer = useViewer().data;
  const threads = useDmThreads();
  const push = usePushRegistration();
  return (
    <LocalBoundary query={query} emptyTitle="No coaching focus yet.">
      {(foci) => {
        const focus = foci.find((f) => f.id === focusId && f.repId === viewer?.id);
        if (!focus) return <LocalRestricted />;
        const thread = threads.data?.find(
          (t) =>
            !t.isCoach &&
            t.participantIds.includes(viewer!.id) &&
            t.participantIds.includes(focus.assignedById),
        );
        return (
          <>
            <LocalLabel>YOUR COACHING FOCUS · {focus.status.toUpperCase()}</LocalLabel>
            <h1 className="type-editorial-h2 min-h-[58px]">{focus.behaviorName}</h1>
            <LocalCard className="min-h-[98px] gap-1.5 py-4">
              <p className="type-ui-body-strong">Manager’s note</p>
              <p className="type-ui-small">{focus.note}</p>
            </LocalCard>
            {focus.evidence.map((e) => (
              <LocalEvidence key={`${e.callId}-${e.tSeconds}`} evidence={e} />
            ))}
            <dl className="type-ui-small">
              <div className="flex gap-2.5 border-b border-by-border-engraved py-2">
                <dt className="type-mono-micro w-[100px] shrink-0 text-by-text-tertiary">
                  Measured on
                </dt>
                <dd>
                  {focus.judgeAfter.calls !== null
                    ? `Your next ${focus.judgeAfter.calls} calls`
                    : focus.judgeAfter.date
                      ? new Date(focus.judgeAfter.date).toLocaleDateString()
                      : "Not specified"}
                </dd>
              </div>
              <div className="flex gap-2.5 border-b border-by-border-engraved py-2">
                <dt className="type-mono-micro w-[100px] shrink-0 text-by-text-tertiary">Target</dt>
                <dd>
                  {focus.target} · {focus.metric}
                </dd>
              </div>
            </dl>
            <LocalAcknowledge key={focus.id} focus={focus} />
            {thread ? (
              <Button variant="secondary" asChild className="justify-start">
                <Link to="/m/dm/$threadId" params={{ threadId: thread.id }} search={true}>
                  Ask your manager a question
                </Link>
              </Button>
            ) : (
              <p className="type-ui-small text-by-text-secondary">
                Manager messaging isn’t available.
              </p>
            )}
            <p className="type-ui-small text-by-text-tertiary">
              {push.data?.enabled ? "Push delivery registered." : "Push delivery isn’t registered."}
            </p>
          </>
        );
      }}
    </LocalBoundary>
  );
}
