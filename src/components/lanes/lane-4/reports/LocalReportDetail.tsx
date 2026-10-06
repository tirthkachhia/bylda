import type { ReactNode } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import {
  useViewer,
  useBrief,
  useCalls,
  ForbiddenForRoleError,
  type Brief,
  type Viewer,
  type Insight,
  type Call,
} from "@/lib/data";
import {
  Button,
  DataBoundary,
  StateEmpty,
  SystemState,
  systemStates,
  InsightCard,
  EvidenceBlock,
  cn,
} from "@/components/bylda";
import {
  LocalSettingsNote,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
import {
  detailAllowed,
  detailMatches,
  detailKind,
  statementAllowed,
  ownEvidence,
  outlineSections,
  outlineId,
  type ReportScreen,
} from "./reportDetailModel";

/** #68 fold-into-kit: report document/metric/outline compositions. Reuses #34 notes/tables. */
export function LocalReportDetail({ screen }: { screen: ReportScreen }) {
  const viewer = useViewer();
  const params = useParams({ strict: false });
  const subject =
    screen === "rep" ? params.repId : screen === "team" ? params.teamId : params.behaviorKey;
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        detailAllowed(person, screen, subject) ? (
          <LocalBriefBoundary screen={screen} subject={subject} viewer={person} />
        ) : (
          <LocalReportDenied />
        )
      }
    </DataBoundary>
  );
}
function LocalReportDenied() {
  return (
    <SystemState
      {...systemStates.permissionDenied()}
      title="This report isn’t available to your role."
      body="Reps can open their own weekly report. Team and behavior reports are for managers."
      actions={[]}
    />
  );
}
function LocalBriefBoundary({
  screen,
  subject,
  viewer,
}: {
  screen: ReportScreen;
  subject?: string;
  viewer: Viewer;
}) {
  const search = useSearch({ strict: false });
  const selected =
    typeof search.reportId === "string" && search.reportId.trim()
      ? search.reportId
      : detailKind[screen];
  const query = useBrief(selected);
  const missing = (
    <LocalDetailBody screen={screen} viewer={viewer} subject={subject} brief={null} />
  );
  return (
    <DataBoundary
      query={query}
      empty={missing}
      error={query.error instanceof ForbiddenForRoleError ? () => <LocalReportDenied /> : undefined}
    >
      {(brief) =>
        !brief ? (
          missing
        ) : detailMatches(brief, screen, subject) ? (
          <LocalDetailBody
            key={brief.id}
            screen={screen}
            viewer={viewer}
            subject={subject}
            brief={brief}
          />
        ) : (
          <StateEmpty
            title="No report matches this subject and format."
            body="The selected report belongs to a different subject or report format."
            actions={[{ label: "Back to reports", href: "/app/reports" }]}
          />
        )
      }
    </DataBoundary>
  );
}
function LocalMetric({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-by-card p-4",
        compact ? "bg-by-surface-inset" : "border border-by-border-engraved bg-by-surface-raised",
      )}
    >
      <h2 className="type-mono-micro text-by-text-tertiary">{label}</h2>
      <p className="type-ui-title">Unavailable</p>
      {!compact && (
        <p className="type-ui-small text-by-text-secondary">Report measurement not supplied.</p>
      )}
    </div>
  );
}
function LocalPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
      <h2 className="type-ui-label">{title}</h2>
      {children}
    </section>
  );
}
function Missing({ children }: { children: ReactNode }) {
  return <p className="type-ui-small text-by-text-secondary">{children}</p>;
}
function LocalActions({ screen }: { screen: ReportScreen }) {
  return (
    <div className="flex flex-wrap gap-2" aria-describedby="report-action-gap">
      {screen !== "outline" && (
        <Button variant="secondary" disabled>
          {screen === "rep" ? "Download PDF" : "Export PDF"}
        </Button>
      )}
      <Button variant={screen === "behavior" ? "primary" : "secondary"} disabled>
        {screen === "behavior" ? "Turn into team focus" : "Share"}
      </Button>
    </div>
  );
}
function LocalDetailBody({
  screen,
  brief,
  viewer,
  subject,
}: {
  screen: ReportScreen;
  brief: Brief | null;
  viewer: Viewer;
  subject?: string;
}) {
  const title =
    brief?.title ??
    {
      rep: "Weekly Rep Report",
      team: "Team Report",
      behavior: "Behavior Report",
      outline: "Weekly Sales Behavior Report",
    }[screen];
  return (
    <div
      className={cn(
        "min-w-0 text-by-text-primary",
        screen === "outline"
          ? "grid min-h-full xl:grid-cols-[minmax(0,1fr)_300px]"
          : "px-8 py-7 lg:px-9",
        screen === "rep" && "lg:px-16 xl:px-40",
      )}
    >
      <article
        className={cn("flex min-w-0 flex-col gap-5", screen === "outline" && "px-8 py-7 xl:px-16")}
      >
        {screen !== "outline" && (
          <Link to="/app/reports" className="type-mono-micro text-by-text-tertiary hover:underline">
            REPORTS / {screen.toUpperCase()}
          </Link>
        )}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="type-mono-micro text-by-text-tertiary">
              {brief?.period ?? "REPORT PERIOD UNAVAILABLE"}
            </p>
            <h1 className={screen === "rep" ? "type-display-l" : "type-editorial-h1"}>{title}</h1>
            {brief && (
              <p className="type-ui-small text-by-text-secondary">
                {brief.readMinutes}-min read · Generated{" "}
                {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            )}
          </div>
          {screen !== "rep" && <LocalActions screen={screen} />}
        </header>
        {!brief && (
          <LocalSettingsNote title="Report unavailable">
            No shared report is available for this subject. This layout shows which report sections
            are waiting for data.
          </LocalSettingsNote>
        )}
        {screen === "rep" ? (
          <LocalRepBody brief={brief} subject={subject!} />
        ) : screen === "team" ? (
          <LocalTeamBody brief={brief} />
        ) : screen === "behavior" ? (
          <LocalBehaviorBody brief={brief} />
        ) : (
          <LocalOutlineBody brief={brief} />
        )}
        {screen === "rep" && (
          <>
            <LocalActions screen={screen} />
            <Missing>
              Only your own report statements and verified own-call evidence are shown here.
            </Missing>
          </>
        )}
        <p id="report-action-gap" className="type-ui-small text-by-text-secondary">
          Sharing, PDF export and report actions are unavailable until the shared action contracts
          are connected.
        </p>
        {screen === "rep" && viewer.role === "rep" && (
          <p className="type-mono-micro text-by-text-tertiary">
            No team rankings here. This view is only about you.
          </p>
        )}
      </article>
      {screen === "outline" && <LocalOutlineContents />}
    </div>
  );
}
function LocalStatements({
  brief,
  subject,
  calls = [],
}: {
  brief: Brief | null;
  subject?: string;
  calls?: Call[];
}) {
  const insights =
    brief?.sections.flatMap((s) => s.insights).filter((i) => statementAllowed(i, subject)) ?? [];
  return (
    <section className="flex flex-col gap-4" aria-label="Report statements">
      {insights.length ? (
        insights.map((insight) => (
          <LocalStatement key={insight.id} insight={insight} subject={subject} calls={calls} />
        ))
      ) : (
        <Missing>
          No supported report statements are available. Statements need confidence, a sample size
          and sufficient analyzed calls; closed-outcome claims also need a verified closed-call
          sample.
        </Missing>
      )}
      {brief?.sections.some((s) => s.body) && (
        <Missing>
          Section narratives are withheld because their confidence and sample size are not supplied.
        </Missing>
      )}
    </section>
  );
}
function LocalStatement({
  insight,
  subject,
  calls,
}: {
  insight: Insight;
  subject?: string;
  calls: Call[];
}) {
  const evidence = subject ? ownEvidence(insight, calls, subject) : insight.evidence;
  return (
    <InsightCard
      kind={insight.kind}
      headline={insight.headline}
      body={subject ? undefined : (insight.body ?? undefined)}
      confidence={insight.confidence}
      sampleSize={insight.sampleSize}
      sampleLabel={subject ? undefined : (insight.sampleLabel ?? undefined)}
      causalTested={insight.causalTested}
    >
      {subject && insight.body && (
        <Missing>
          The statement’s additional narrative is withheld until its personal-only scope is
          verified.
        </Missing>
      )}
      {evidence.map((e, index) => (
        <EvidenceBlock
          key={index}
          evidence={{
            timestamp: e.timestamp,
            speaker: e.speakerLabel,
            quote: e.quote,
            href: "/app/calls/" + encodeURIComponent(e.callId) + "/transcript#t-" + e.tSeconds,
          }}
        />
      ))}
    </InsightCard>
  );
}
function LocalRepBody({ brief, subject }: { brief: Brief | null; subject: string }) {
  const calls = useCalls({ repId: subject });
  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {["DISCOVERY", "NEXT STEP BOOKED", "HELD CONTROL IN OBJECTIONS"].map((label) => (
          <LocalMetric key={label} label={label} />
        ))}
      </div>
      <LocalPanel title="YOUR FOCUS">
        <dl className="type-ui-small divide-y divide-by-border-engraved rounded-by-card bg-by-surface-inset px-4">
          {["Status", "Measured so far", "Next check"].map((label) => (
            <div key={label} className="grid grid-cols-3 gap-3 py-3">
              <dt className="type-mono-micro text-by-text-tertiary">{label}</dt>
              <dd className="col-span-2">Report snapshot unavailable</dd>
            </div>
          ))}
        </dl>
      </LocalPanel>
      <h2 className="type-ui-label">MOMENTS AND REPORT STATEMENTS</h2>
      <DataBoundary
        query={calls}
        empty={<LocalStatements brief={brief} subject={subject} />}
        error={
          calls.error instanceof ForbiddenForRoleError ? () => <LocalReportDenied /> : undefined
        }
      >
        {(ownCalls) => <LocalStatements brief={brief} subject={subject} calls={ownCalls} />}
      </DataBoundary>
    </>
  );
}
function LocalTeamBody({ brief }: { brief: Brief | null }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          "CALLS ANALYZED",
          "COACHING FOCUSES",
          "BEHAVIORS IMPROVING",
          "BEHAVIORS REGRESSING",
          "DEALS ADVANCED",
        ].map((label) => (
          <LocalMetric key={label} label={label} />
        ))}
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <LocalPanel title="BEHAVIOR TRAJECTORY · TEAM COMPOSITE">
          <div className="flex min-h-40 items-center rounded-by-control bg-by-surface-inset p-4">
            <Missing>
              Trajectory unavailable. The report needs measured points, a fixed behavior range,
              confidence and sample size.
            </Missing>
          </div>
        </LocalPanel>
        <LocalPanel title="COACHING RESULTS THIS PERIOD">
          <Missing>
            No report-period coaching results supplied. Current coaching is not substituted for a
            report snapshot.
          </Missing>
        </LocalPanel>
      </div>
      <h2 className="type-ui-label">BY REP</h2>
      <LocalSettingsTable headings={["REP", "CALLS", "TRAJECTORY", "BIGGEST CHANGE", "COACHING"]}>
        <tr>
          <td colSpan={5} className={cell}>
            No report-period rep rows supplied.
          </td>
        </tr>
      </LocalSettingsTable>
      <LocalStatements brief={brief} />
    </>
  );
}
function LocalBehaviorBody({ brief }: { brief: Brief | null }) {
  return (
    <>
      <LocalStatements brief={brief} />
      <div className="grid gap-5 md:grid-cols-2">
        {["WHAT STRONG HANDLING LOOKS LIKE", "WHAT WEAK HANDLING LOOKS LIKE"].map((title) => (
          <LocalPanel key={title} title={title}>
            <Missing>
              No supported sequence description supplied. Confidence, sample size and evidence are
              required.
            </Missing>
          </LocalPanel>
        ))}
      </div>
      <h2 className="type-ui-label">SEQUENCE ANALYSIS</h2>
      <LocalSettingsTable headings={["STEP", "STRONG CALLS", "WEAK CALLS", "REPS WHO DO IT"]}>
        <tr>
          <td colSpan={4} className={cell}>
            Sequence analysis unavailable for this behavior.
          </td>
        </tr>
      </LocalSettingsTable>
      <LocalSettingsNote title="EVIDENCE">
        No behavior-report clips supplied. Outcome associations remain unavailable without a
        verified closed-call sample.
      </LocalSettingsNote>
    </>
  );
}
function LocalOutlineBody({ brief }: { brief: Brief | null }) {
  return (
    <>
      {outlineSections.map((heading, index) => (
        <details
          key={heading}
          id={outlineId(index)}
          open={index === 0}
          className="group scroll-mt-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-4 py-4"
        >
          <summary className="type-editorial-h2 flex cursor-pointer list-none items-center gap-3 focus-visible:outline focus-visible:outline-by-focus-ring">
            <span
              aria-hidden="true"
              className="type-ui-body text-by-text-tertiary group-open:rotate-90"
            >
              ›
            </span>
            {heading}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {index === 0 ? (
              <>
                <Missing>
                  The executive summary and its measurements are unavailable. Supplied statements
                  appear below without inventing a summary.
                </Missing>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {["Discovery depth", "Price objections", "Held control", "Coaching held"].map(
                    (label) => (
                      <LocalMetric key={label} label={label} compact />
                    ),
                  )}
                </div>
              </>
            ) : (
              <Missing>No report data is mapped to this outline section yet.</Missing>
            )}
          </div>
        </details>
      ))}
      <LocalPanel title="SUPPLIED REPORT STATEMENTS">
        <LocalStatements brief={brief} />
      </LocalPanel>
    </>
  );
}
function LocalOutlineContents() {
  return (
    <aside
      aria-label="Report contents"
      className="flex flex-col gap-5 border-l border-by-border-engraved bg-by-surface-raised p-6"
    >
      <h2 className="type-ui-label">ON THIS PAGE</h2>
      {outlineSections.map((heading, index) => (
        <a
          key={heading}
          href={"#" + outlineId(index)}
          className="type-ui-small text-by-text-secondary hover:underline"
          onClick={() => {
            const element = document.getElementById(outlineId(index));
            if (element instanceof HTMLDetailsElement) element.open = true;
          }}
        >
          {heading}
        </a>
      ))}
      <h2 className="type-ui-label">COMMENTS</h2>
      <Missing>
        Report comments and collaborators are unavailable. No comments have been created.
      </Missing>
    </aside>
  );
}
