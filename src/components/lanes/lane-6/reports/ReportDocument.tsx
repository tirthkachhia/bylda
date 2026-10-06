import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  useBrief,
  useViewer,
  ForbiddenForRoleError,
  isInsightSufficient,
  gateInsight,
  type Brief,
  type BriefSection,
  type Insight,
  type Viewer,
} from "@/lib/data";
import {
  Button,
  DataBoundary,
  EvidenceBlock,
  InsightCard,
  SystemState,
  StateEmpty,
  cn,
  systemStates,
} from "@/components/bylda";
import { evidenceIn, isManagerBriefAllowed, sectionId, selectedReport } from "./reportModel";

export function ReportDocument({ weekly = false }: { weekly?: boolean }) {
  const search = useSearch({ strict: false });
  const viewer = useViewer();
  const report = useBrief(selectedReport(search, weekly ? "weekly_manager" : "daily_manager"));
  return (
    <DataBoundary query={viewer}>
      {(v) =>
        !isManagerBriefAllowed(v) ? (
          <ReportDenied />
        ) : (
          <DataBoundary
            query={report}
            empty={
              <StateEmpty
                title="This report isn’t available."
                body="Choose another report from the index."
                actions={[{ label: "Back to reports", href: "/app/reports" }]}
              />
            }
            error={
              report.error instanceof ForbiddenForRoleError ? () => <ReportDenied /> : undefined
            }
          >
            {(b) =>
              b && b.kind === (weekly ? "weekly_manager" : "daily_manager") ? (
                <DocumentBody brief={b} viewer={v} weekly={weekly} />
              ) : (
                <StateEmpty
                  title="This report has a different format."
                  body="Open it from the report index."
                  actions={[{ label: "Back to reports", href: "/app/reports" }]}
                />
              )
            }
          </DataBoundary>
        )
      }
    </DataBoundary>
  );
}
function ReportDenied() {
  return (
    <SystemState
      {...systemStates.permissionDenied()}
      title="Manager reports aren’t available to your role."
      body="Your own rep reports are available in the report index."
    />
  );
}
function DocumentBody({
  brief,
  viewer,
  weekly,
}: {
  brief: Brief;
  viewer: Viewer;
  weekly: boolean;
}) {
  const [notice, setNotice] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState("");
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Report link copied. Workspace permissions still apply.");
    } catch {
      setNotice("Copy this page’s URL to share it. Workspace permissions still apply.");
    }
  };
  const evidence = evidenceIn(brief);
  return (
    <div className={cn("min-w-0 px-7 pb-10", weekly && "xl:pr-0 xl:pl-[120px]")}>
      <header
        className={cn(
          "flex flex-wrap items-center gap-2",
          "min-h-12 border-b border-by-border-engraved px-0 py-1",
          weekly && "xl:max-w-[608px]",
        )}
      >
        <div className="type-mono-micro mr-auto flex flex-wrap gap-3 text-by-text-tertiary">
          <Link to="/app/reports">REPORTS</Link>
          <span>/</span>
          <span>{weekly ? "WEEKLY" : "DAILY BRIEFS"}</span>
          <span>/</span>
          <span>{brief.period.toUpperCase()}</span>
        </div>
        <Button variant="ghost" onClick={() => setCommenting(!commenting)}>
          Comment
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            setNotice("Report pinning isn’t connected yet. No report was posted to a room.")
          }
        >
          {weekly ? "Pin to room" : "Pin to #daily-brief"}
        </Button>
        <Button variant="secondary" onClick={() => void share()}>
          Share
        </Button>
        <Button
          variant="secondary"
          onClick={() => setNotice("PDF export isn’t connected yet. No PDF was generated.")}
        >
          Export PDF
        </Button>
      </header>
      {notice && (
        <p
          role="status"
          className="type-ui-small my-4 rounded-by-control border border-by-border-engraved bg-by-surface-inset p-3"
        >
          {notice}
        </p>
      )}
      <div
        className={cn(
          "grid min-w-0 items-start gap-[60px]",
          weekly
            ? "max-w-[1008px] pt-7 xl:gap-[120px] xl:grid-cols-[minmax(0,608px)_280px]"
            : "max-w-[960px] pt-12 xl:ml-[92px] xl:grid-cols-[minmax(0,680px)_220px]",
        )}
      >
        <article className="min-w-0">
          <div className="flex flex-col gap-4 pb-4">
            <p className="type-mono-micro text-by-text-tertiary">
              {brief.title.toUpperCase()}{" "}
              {viewer.team?.name && `· ${viewer.team.name.toUpperCase()}`}
            </p>
            <h1 className="type-display-l">{brief.period}</h1>
            <div className="type-mono-micro flex flex-wrap gap-3 text-by-text-secondary">
              <span>{viewer.team && `${viewer.team.repCount} reps`}</span>
              <span>{brief.readMinutes}-min read</span>
              <span>
                Generated{" "}
                {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          {brief.sections.map((s, i) => (
            <DocumentSection key={`${i}-${s.heading}`} section={s} index={i} weekly={weekly} />
          ))}
          {!brief.sections.length && (
            <StateEmpty
              title="This report has no sections yet."
              body="Check back when analysis is available."
            />
          )}
        </article>
        <aside
          aria-label="Report contents"
          className={cn(
            "sticky top-0 flex min-w-0 flex-col gap-3 pt-3",
            weekly && "border-l border-by-border-engraved bg-by-surface-raised p-5",
          )}
        >
          <h2 className="type-mono-micro text-by-text-tertiary">ON THIS PAGE</h2>
          {brief.sections.map((s, i) => (
            <a
              key={i}
              href={`#${sectionId(i)}`}
              onClick={() => {
                const el = document.getElementById(sectionId(i));
                if (el instanceof HTMLDetailsElement) el.open = true;
              }}
              className="type-ui-small text-by-text-secondary hover:text-by-text-primary"
            >
              {s.heading}
            </a>
          ))}
          <h2 className="type-ui-label mt-3">COMMENTS</h2>
          <p className="type-ui-small text-by-text-secondary">
            Report comments aren’t connected yet.
          </p>
          {commenting && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setNotice("Your comment is a local draft only. It has not been saved or posted.");
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="report-comment" className="type-ui-small">
                Comment draft · not saved
              </label>
              <textarea
                id="report-comment"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="type-ui-small min-h-24 rounded-by-control border border-by-border-strong bg-by-surface-raised p-3"
              />
              <Button variant="secondary" type="submit" disabled={!draft.trim()}>
                Keep draft
              </Button>
            </form>
          )}
          <h2 className="type-ui-label mt-3">LINKED</h2>
          <p className="type-ui-small text-by-text-secondary">
            {new Set(evidence.map((e) => e.callId)).size} evidence calls
          </p>
          {evidence.map((e, i) => (
            <Link
              key={i}
              to="/app/calls/$callId/transcript"
              params={{ callId: e.callId }}
              hash={`t-${e.tSeconds}`}
              className="type-mono-data text-by-text-secondary hover:underline"
            >
              {e.timestamp} · {e.speakerLabel}
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
function DocumentSection({
  section,
  index,
  weekly,
}: {
  section: BriefSection;
  index: number;
  weekly: boolean;
}) {
  const content = (
    <div className="flex flex-col gap-4 pb-4">
      {section.body && (
        <p className="type-ui-small text-by-text-secondary">
          Section narrative is withheld until confidence and sample size are available.
        </p>
      )}
      {section.insights.filter(isInsightSufficient).map((i) => (
        <ReportInsight key={i.id} insight={i} />
      ))}
      {section.insights
        .map(gateInsight)
        .filter((i) => i.state === "insufficient")
        .map((i) => (
          <SystemState
            key={i.id}
            {...systemStates.insufficientData({ seenIn: i.callsAnalyzed, needed: i.callsNeeded })}
            title="Not enough analyzed calls for this report statement."
            body={`${i.callsAnalyzed} analyzed calls available; ${i.callsNeeded} required.`}
            actions={[]}
          />
        ))}
      {!section.body && !section.insights.some(isInsightSufficient) && (
        <p className="type-ui-small text-by-text-secondary">
          No supported statements in this section yet.
        </p>
      )}
    </div>
  );
  if (weekly)
    return (
      <details
        id={sectionId(index)}
        open={index < 4}
        className="group scroll-mt-4 border-t border-by-border-engraved py-4"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2.5 pb-4">
          <span
            aria-hidden="true"
            className="type-ui-body text-by-text-tertiary group-open:rotate-90"
          >
            ▸
          </span>
          <h2 className="type-editorial-h2 flex-1">{section.heading}</h2>
        </summary>
        {content}
      </details>
    );
  return (
    <section id={sectionId(index)} className="scroll-mt-4 border-t border-by-border-engraved pt-4">
      <h2 className="type-editorial-h2 mb-4">{section.heading}</h2>
      {content}
    </section>
  );
}
function ReportInsight({ insight }: { insight: Insight }) {
  return (
    <InsightCard
      kind={insight.kind}
      headline={insight.headline}
      body={insight.body ?? undefined}
      confidence={insight.confidence}
      sampleSize={insight.sampleSize}
      sampleLabel={insight.sampleLabel ?? undefined}
      tag={insight.tag ? { tone: insight.tone, label: insight.tag } : undefined}
      causalTested={insight.causalTested}
    >
      {insight.evidence.map((e, i) => (
        <Link
          key={i}
          to="/app/calls/$callId/transcript"
          params={{ callId: e.callId }}
          hash={`t-${e.tSeconds}`}
        >
          <EvidenceBlock
            evidence={{ timestamp: e.timestamp, speaker: e.speakerLabel, quote: e.quote }}
          />
        </Link>
      ))}
      {insight.confidence !== "low" && insight.action && <InsightActionLink insight={insight} />}
    </InsightCard>
  );
}
function InsightActionLink({ insight }: { insight: Insight }) {
  const action = insight.action;
  if (!action || insight.confidence === "low") return null;
  if (action.type === "assign_coaching")
    return (
      <Button variant="secondary" asChild>
        <Link to="/app/coaching/assign">{action.label}</Link>
      </Button>
    );
  if (action.type === "review_calls" && action.callIds[0])
    return (
      <Button variant="secondary" asChild>
        <Link to="/app/calls/$callId" params={{ callId: action.callIds[0] }}>
          {action.label}
        </Link>
      </Button>
    );
  if (action.type === "open_behavior")
    return (
      <Button variant="secondary" asChild>
        <Link
          to="/app/intelligence/behaviors/$behaviorKey"
          params={{ behaviorKey: action.behaviorKey }}
        >
          {action.label}
        </Link>
      </Button>
    );
  return null;
}
