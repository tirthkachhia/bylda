import { momentKey } from "./mobile-evidence";
import { Link } from "@tanstack/react-router";
import { ConfidenceMeter } from "@/components/bylda";
import {
  useMyCalls,
  useRepHome,
  useViewer,
  REP_INSIGHT_MIN_CALLS,
  isInsightSufficient,
} from "@/lib/data";
import {
  LocalRepOnly,
  LocalBoundary,
  LocalMobileFrame,
  LocalCard,
  LocalLabel,
} from "./LocalMobile";
export function B1MobileRepDailyBrief() {
  return (
    <LocalMobileFrame active="Brief">
      <LocalRepOnly>
        <LocalBrief />
      </LocalRepOnly>
    </LocalMobileFrame>
  );
}
function LocalBrief() {
  const query = useRepHome();
  const calls = useMyCalls();
  const viewer = useViewer().data;
  return (
    <LocalBoundary query={query} emptyTitle="Your brief isn’t ready yet.">
      {(home) => {
        if (!home || home.rep.id !== viewer?.id)
          return <p className="type-ui-body">Your brief isn’t available.</p>;
        const focus = home.focus?.repId === viewer.id ? home.focus : null;
        const insight =
          home.analyzedCalls >= REP_INSIGHT_MIN_CALLS
            ? home.insights.find(
                (g) =>
                  g.state === "insight" &&
                  g.insight.kind !== "pattern" &&
                  g.insight.affectedRepIds.length === 1 &&
                  g.insight.affectedRepIds[0] === viewer.id &&
                  isInsightSufficient(g.insight),
              )
            : undefined;
        const evidence = focus?.evidence.find((e) =>
          calls.data?.some((c) => c.id === e.callId && c.repId === viewer.id),
        );
        return (
          <>
            <LocalLabel>YOUR DAILY BRIEF</LocalLabel>
            <h1 className="type-editorial-h1">Morning, {home.rep.firstName}.</h1>
            {insight?.state === "insight" ? (
              <div className="flex flex-col gap-2">
                <p className="type-editorial-insight">{insight.insight.headline}</p>
                <ConfidenceMeter
                  level={insight.insight.confidence}
                  sampleSize={insight.insight.sampleSize}
                />
              </div>
            ) : (
              <p className="type-ui-small text-by-text-secondary">
                Insights need {REP_INSIGHT_MIN_CALLS} analyzed calls. You have {home.analyzedCalls}.
              </p>
            )}
            {focus ? (
              <LocalCard dark className="min-h-[210px]">
                <LocalLabel>TODAY’S FOCUS</LocalLabel>
                <h2 className="type-editorial-h2">{focus.behaviorName}</h2>
                <p className="type-ui-small">{focus.note}</p>
                <Link
                  className="type-ui-body-strong px-3.5 py-2"
                  to="/m/coaching/$focusId"
                  params={{ focusId: focus.id }}
                  search={true}
                >
                  View focus
                </Link>
              </LocalCard>
            ) : (
              <p className="type-ui-body">No active coaching focus.</p>
            )}
            {evidence && (
              <Link
                to="/m/moments/$momentId"
                params={{ momentId: momentKey(evidence) }}
                search={true}
                className="flex flex-col gap-1.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-3.5 py-3"
              >
                <LocalLabel>HEAR THE MOMENT</LocalLabel>
                <p className="type-ui-body-strong">
                  {calls.data?.find((c) => c.id === evidence.callId)?.account.name} ·{" "}
                  {evidence.timestamp}
                </p>
                <div aria-hidden className="h-[3px] w-full bg-by-border-engraved" />
              </Link>
            )}
            <Link to="/m/ask" search={true} className="type-ui-small text-by-text-secondary">
              Ask BYLDA Coach
            </Link>
          </>
        );
      }}
    </LocalBoundary>
  );
}
