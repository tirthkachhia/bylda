import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Lightbulb,
  MessageCircle,
  MessageCircleQuestionMark,
  MessagesSquare,
  Mic,
  PhoneCall,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { reportCitationSeconds } from "@/lib/coaching/behavior";
import { parseCallSourceTarget } from "@/lib/coaching/source-navigation";
import { callsSearchFromSource } from "@/lib/coaching/calls-search";
import {
  comparableTrends,
  savedPeriod,
  type ReportPeriod,
  type SavedReport,
} from "@/lib/coaching/report-views";
import type { GuidelineTrend, ReportCitation } from "@/lib/coaching/types";
import { ReportCallEvidence } from "./ReportCallEvidence";

export function DashboardStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
}) {
  return (
    <div className="page30-final-card page30-final-stat">
      <span className="page30-final-icon">
        <Icon size={21} aria-hidden="true" />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="page30-final-heading">
      <Icon size={22} aria-hidden="true" />
      {children}
    </h2>
  );
}

function rate(counts: GuidelineTrend["current"]) {
  return Math.round(((counts.followed + counts.partial / 2) / counts.judged) * 100);
}

export function CoachingReportView({
  rows,
  period,
  team = false,
  names,
  headingLevel = 1,
}: {
  rows: SavedReport[];
  period: ReportPeriod;
  team?: boolean;
  names?: ReadonlyMap<string, string>;
  headingLevel?: 1 | 2;
}) {
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [analysis, setAnalysis] = useState<"behaviors" | "delivery" | "flow">("behaviors");
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [first] = rows;
  if (!first?.report) return null;
  const subject = (row: SavedReport) => names?.get(row.rep_id) ?? "Team member";
  const findings = rows.flatMap((row) => {
    const report = row.report;
    if (!report) return [];
    return [
      ...(report.strength ? [{ ...report.strength, row, strength: true, action: "" }] : []),
      ...(report.patterns ?? []).map((pattern) => ({
        ...pattern,
        row,
        strength: false,
        action: pattern.say_instead,
      })),
    ];
  });
  const moments = findings.flatMap((finding) =>
    (finding.cited ?? []).map((citation) => ({ ...finding, citation })),
  );
  const explanations = findings.flatMap((finding) => {
    const interpretation = finding.cited?.find(
      (citation) => citation.why_it_matters,
    )?.why_it_matters;
    return finding.cited?.length && (interpretation || finding.what_happened)
      ? [{ ...finding, explanation: interpretation || finding.what_happened }]
      : [];
  });
  const callCount = rows.reduce((total, row) => total + row.call_count, 0);
  const cited = new Set(moments.map((moment) => moment.citation.call_id)).size;
  const strengths = findings.filter((finding) => finding.strength);
  const opportunities = findings.filter((finding) => !finding.strength);
  const trends = team ? [] : comparableTrends(first);
  const improved = trends.filter((trend) => (trend.change ?? 0) > 0);
  const scores = team
    ? []
    : (first.adherence ?? []).filter((item) => item.followed + item.partial + item.missed > 0);
  const focus = rows.flatMap((row) => {
    const drill = row.report?.drill;
    return drill?.focus || drill?.line_to_practice
      ? [{ row, title: drill.focus, action: drill.line_to_practice }]
      : [];
  });
  const tasks = [
    ...new Map(
      [...focus, ...opportunities.filter((finding) => finding.action)].map((item) => [
        (team ? item.row.rep_id + ":" : "") + (item.action || item.title),
        item,
      ]),
    ).values(),
  ];
  const Heading = headingLevel === 1 ? "h1" : "h2";

  function openCall(
    row: SavedReport,
    callId: string,
    seconds: number | null,
    citation: ReportCitation,
  ) {
    if (!currentOrgId) return;
    const source = citation.behavior_source;
    try {
      const target = parseCallSourceTarget({
        organizationId: currentOrgId,
        repId: row.rep_id,
        callId,
        startSeconds: seconds,
        source: source
          ? {
              kind: "behavior",
              runId: source.run_id,
              turnId: source.turn_id,
              eventId: source.event_id,
            }
          : { kind: "report", reportId: row.id },
      });
      void navigate({ to: "/app/crm/calls", search: callsSearchFromSource(target) });
    } catch {
      toast.error("Source unavailable");
    }
  }

  return (
    <article
      className="page30-final page30-final-report"
      data-report-period={period}
      aria-label={team ? "Weekly team report" : "Rep report"}
    >
      <header className="page30-final-top">
        <div>
          <p className="page30-label">
            Bylda / {period === "daily" ? "Daily report" : "Weekly report"}
          </p>
          <Heading>
            {team
              ? "Weekly Team Report"
              : period === "daily"
                ? "Daily Rep Report"
                : "Weekly Rep Report"}
            {summaryOnly ? " – Summary" : " – Full Analysis"}
          </Heading>
          <p className="page30-final-muted">
            {savedPeriod(first)} · {team ? "Saved rep reports in your scope" : "Saved report"}
          </p>
        </div>
        <div className="page30-final-toggle" role="group" aria-label="Report detail">
          <button type="button" aria-pressed={summaryOnly} onClick={() => setSummaryOnly(true)}>
            Summary view
          </button>
          <button type="button" aria-pressed={!summaryOnly} onClick={() => setSummaryOnly(false)}>
            Full analysis
          </button>
        </div>
      </header>

      <section className="page30-final-card page30-final-summary">
        <div>
          <SectionHeading icon={ClipboardList}>
            {team ? "Team summary" : period === "daily" ? "Daily summary" : "Weekly summary"}
          </SectionHeading>
          {team ? (
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <strong>{subject(row)}</strong> ·{" "}
                  {row.report?.headline || "Saved report available"}
                </li>
              ))}
            </ul>
          ) : (
            <p>{first.report.headline || "This report has no saved summary."}</p>
          )}
        </div>
        <div>
          <SectionHeading icon={Target}>
            {team
              ? "Team coaching focus"
              : period === "daily"
                ? "Your focus for the next call"
                : "Your focus for next week"}
          </SectionHeading>
          {team ? (
            <p>
              {focus.length
                ? "Review each rep’s saved coaching focus below."
                : "No coaching focus is saved for this period."}
            </p>
          ) : (
            <>
              <strong>{focus[0]?.title || "No saved focus"}</strong>
              {focus[0]?.action && <p>{focus[0].action}</p>}
            </>
          )}
        </div>
      </section>
      <div className="page30-final-stats">
        <DashboardStat
          icon={PhoneCall}
          value={callCount}
          label={team ? "Calls across saved reports" : "Calls reviewed"}
        />
        <DashboardStat
          icon={CircleCheck}
          value={strengths.reduce((n, f) => n + (f.cited?.length ?? 0), 0)}
          label="Cited strengths"
        />
        <DashboardStat
          icon={Target}
          value={focus.length}
          label={team ? "Rep coaching focuses" : "Focus areas"}
        />
        <DashboardStat icon={MessageCircle} value={cited} label="Calls with evidence" />
      </div>
      {!summaryOnly && (
        <>
          <div className="page30-final-two">
            {[
              { label: "What went well", icon: CircleCheck, list: strengths },
              { label: "What to improve", icon: TriangleAlert, list: opportunities },
            ].map(({ label, icon, list }) => (
              <section key={label} className="page30-final-card">
                <SectionHeading icon={icon}>{label}</SectionHeading>
                {list.length ? (
                  <ul>
                    {list.map((f, index) => (
                      <li key={index}>
                        <strong>
                          {team && subject(f.row) + " · "}
                          {f.title}
                        </strong>
                        <p>{f.what_happened}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="page30-final-muted">No finding was saved for this section.</p>
                )}
              </section>
            ))}
          </div>
          {period === "weekly" && (
            <section className="page30-final-card">
              <SectionHeading icon={TrendingUp}>What improved</SectionHeading>
              {improved.length ? (
                <>
                  <p className="page30-final-muted">
                    Playbook adherence on judged calls. Partial adherence earns half credit.
                  </p>
                  <div className="page30-final-growth">
                    {improved.map((t) => (
                      <div key={t.guideline_id} className="page30-final-inset">
                        <strong>{t.title}</strong>
                        <p>
                          Prior {rate(t.previous)}% · {t.previous.judged} judged
                        </p>
                        <p>
                          Current {rate(t.current)}% · {t.current.judged} judged
                        </p>
                        <span className="page30-final-pill" data-tone="green">
                          +{Math.round(t.change! * 100)} pp
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="page30-final-muted">
                  {team
                    ? "Team-level change is unavailable. Open a rep’s saved report for their comparable results."
                    : (first.report.since_last?.limitation ??
                      "This report has no supported improvements across comparable periods.")}
                </p>
              )}
            </section>
          )}
          <section className="page30-final-card">
            <div className="page30-final-top">
              <h2>Key Call Moments</h2>
              <Link className="page30-source-link" to="/app/crm/calls">
                Open Calls <ArrowUpRight size={14} />
              </Link>
            </div>
            {moments.length ? (
              <div className="page30-final-list">
                {moments.map(({ row, citation, title, what_happened, strength }, index) => {
                  const Icon = strength ? MessageCircle : MessageCircleQuestionMark;
                  return (
                    <details
                      key={
                        row.id +
                        ":" +
                        citation.call_id +
                        ":" +
                        citation.exchange_index +
                        ":" +
                        index
                      }
                      className="page30-final-moment"
                    >
                      <summary>
                        <span className="page30-final-icon">
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        {reportCitationSeconds(citation) !== null && (
                          <time className="page30-final-pill">{citation.at}</time>
                        )}
                        <span className="page30-final-moment-copy">
                          <strong>
                            {team && subject(row) + " · "}
                            {title}
                          </strong>
                          <span className="page30-final-row-copy">{what_happened}</span>
                        </span>
                        <span className="page30-final-pill" data-tone={strength ? "green" : "red"}>
                          {strength ? "Strength" : "Coaching opportunity"}
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </summary>
                      <ReportCallEvidence
                        citation={citation}
                        organizationId={currentOrgId}
                        repId={row.rep_id}
                        onOpenCall={(id, at, c) => openCall(row, id, at, c)}
                      />
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="page30-final-muted">No call moments are cited in this report.</p>
            )}
          </section>
          <div className="page30-final-analysis-grid">
            <section className="page30-final-card">
              <SectionHeading icon={BarChart3}>Behavioral Analysis</SectionHeading>
              <div
                className="page30-final-toggle"
                role="group"
                aria-label="Behavioral analysis view"
              >
                {(
                  [
                    ["behaviors", "Behaviors"],
                    ["delivery", "Tone & pacing"],
                    ["flow", "Conversation flow"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    aria-pressed={analysis === id}
                    key={id}
                    onClick={() => setAnalysis(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={analysis === "behaviors" ? "page30-final-behavior-grid" : undefined}>
                {analysis === "behaviors" &&
                  (scores.length ? (
                    <ul className="page30-final-behaviors">
                      {scores.map((s) => {
                        const trend = trends.find((t) => t.guideline_id === s.guideline_id);
                        const judged = s.followed + s.partial + s.missed;
                        return (
                          <li key={s.guideline_id ?? s.guideline}>
                            <strong>{s.guideline}</strong>
                            <span>{judged} judged</span>
                            <span className="page30-final-pill">
                              {Math.round(((s.followed + s.partial / 2) / judged) * 100)}%
                            </span>
                            {trend && (
                              <span
                                className="page30-final-pill"
                                data-tone={(trend.change ?? 0) > 0 ? "green" : "red"}
                              >
                                {(trend.change ?? 0) > 0 ? "+" : ""}
                                {Math.round(trend.change! * 100)} pp
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="page30-final-muted">
                      {team
                        ? "Team-level behavior scores are unavailable."
                        : "No scored playbook behaviors were saved."}
                    </p>
                  ))}
                {analysis !== "flow" && (
                  <ul
                    className="page30-final-behaviors page30-final-delivery"
                    aria-label="Delivery signals"
                  >
                    <li>
                      <Mic size={17} aria-hidden="true" />
                      <strong>Tone</strong>
                      <span>Unavailable in saved reports</span>
                    </li>
                    <li>
                      <Timer size={17} aria-hidden="true" />
                      <strong>Pacing</strong>
                      <span>Unavailable in saved reports</span>
                    </li>
                    <li>
                      <MessagesSquare size={17} aria-hidden="true" />
                      <strong>Talk ratio</strong>
                      <span>Unavailable in saved reports</span>
                    </li>
                  </ul>
                )}
                {analysis === "flow" && (
                  <ul className="page30-final-behaviors">
                    {moments.length ? (
                      moments.map((m, index) => (
                        <li key={index}>
                          <CalendarCheck size={17} aria-hidden="true" />
                          <strong>{m.title}</strong>
                          <span>
                            {reportCitationSeconds(m.citation) !== null
                              ? m.citation.at
                              : "Time unavailable"}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li>No cited call moments are saved.</li>
                    )}
                  </ul>
                )}
              </div>
              <div className="page30-final-why">
                <h3>Why it matters</h3>
                {explanations.length ? (
                  <ul>
                    {explanations.map((f, index) => (
                      <li key={index}>
                        <strong>
                          {team && subject(f.row) + " · "}
                          {f.title}
                        </strong>
                        <p>{f.explanation}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="page30-final-muted">
                    No evidence-backed explanation was saved for this period.
                  </p>
                )}
              </div>
            </section>
            <section className="page30-final-card">
              <SectionHeading icon={Lightbulb}>Recommendations</SectionHeading>
              {tasks.length ? (
                <ol className="page30-final-list">
                  {tasks.map((task, index) => (
                    <li key={index} className="page30-final-inset">
                      <strong>
                        {team && subject(task.row) + " · "}
                        {task.title || "Practice line"}
                      </strong>
                      {task.action && <p>{task.action}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="page30-final-muted">No recommendations were saved for this period.</p>
              )}
              <Link className="figma-button page30-primary" to="/app/coaching">
                Open coaching <ArrowUpRight size={14} />
              </Link>
            </section>
          </div>
        </>
      )}
    </article>
  );
}
