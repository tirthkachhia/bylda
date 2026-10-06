import { Link } from "@tanstack/react-router";
import { Avatar, ConfidenceMeter } from "@/components/bylda";
import { useHomeFeed, useViewer, isInsightSufficient } from "@/lib/data";
import { LocalBoundary, LocalCard, LocalLabel, LocalMobileFrame } from "./LocalMobile";
import { LocalManagerOnly } from "./LocalMobileMessages";
export function B2MobileManagerBriefAlert() {
  return (
    <LocalMobileFrame active="Brief">
      <LocalManagerOnly>
        <LocalBrief />
      </LocalManagerOnly>
    </LocalMobileFrame>
  );
}
function LocalBrief() {
  const query = useHomeFeed();
  const viewer = useViewer().data;
  return (
    <LocalBoundary query={query} emptyTitle="Your team brief isn’t ready yet.">
      {(feed) => (
        <>
          <div className="flex gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-3.5 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-by-control bg-by-surface-rail text-by-text-on-dark">
              B
            </span>
            <div>
              <LocalLabel>BYLDA · NEEDS ATTENTION</LocalLabel>
              <p className="type-ui-small">
                {feed.attention.length} {feed.attention.length === 1 ? "item needs" : "items need"}{" "}
                review.
              </p>
            </div>
          </div>
          <h1 className="type-editorial-h2">Good morning, {viewer?.name.split(" ")[0]}.</h1>
          <div className="flex flex-col">
            {feed.coachQueue.map((q) => (
              <Link
                key={q.repId + q.behaviorName}
                to="/app/coaching/assign"
                search={true}
                className="flex items-start gap-2.5 border-b border-by-border-engraved py-4"
              >
                <Avatar name={q.repName} size={28} />
                <div>
                  <p className="type-ui-body-strong">
                    {q.repName} — {q.behaviorName}
                  </p>
                  <p className="type-ui-small text-by-text-secondary">{q.reason}</p>
                </div>
              </Link>
            ))}
          </div>
          {feed.items
            .filter((f) => f.insight.kind === "pattern" && isInsightSufficient(f.insight))
            .map((f) => (
              <LocalCard key={f.id} className="gap-1.5 px-3.5 py-3">
                <LocalLabel>PATTERN</LocalLabel>
                <p className="type-ui-body">{f.insight.headline}</p>
                <ConfidenceMeter
                  level={f.insight.confidence}
                  sampleSize={f.insight.sampleSize}
                  className="flex-wrap gap-2"
                />
              </LocalCard>
            ))}
          {feed.attention.map((a) => (
            <Link key={a.id} to={a.href as never} search={true} className="type-ui-small underline">
              {a.title}
            </Link>
          ))}
        </>
      )}
    </LocalBoundary>
  );
}
