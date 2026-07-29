import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { organizationQuery, toolRunsQuery, leadsQuery } from "@/lib/queries";
import { ByldaAvatar } from "./ByldaAvatar";

type ByldaMood = "active" | "thinking" | "alert" | "idle";

const STAGES = ["Idea", "Validate", "Launch", "Operate", "Scale"];

function computeScore(runs: number, leads: number, stageIdx: number): number {
  let s = 20;
  if (runs >= 1) s += 15;
  if (runs >= 5) s += 10;
  if (leads >= 1) s += 15;
  if (stageIdx >= 1) s += 10;
  return Math.min(100, s);
}

function byldaDirective(
  path: string,
  stage: string,
  score: number,
  runs: number,
  leads: number,
): string {
  if (path.includes("/launchpad")) {
    if (runs === 0)
      return "You haven't run any tools yet — start with Idea Validation. It sets the foundation for everything that follows.";
    return `${runs} tool${runs !== 1 ? "s" : ""} complete. Keep your ${stage} stage execution tight — finish the remaining tools before moving on.`;
  }
  if (path.includes("/mentor")) {
    return "Your specialist agents are standing by. Give them a specific challenge and they'll return a concrete execution plan.";
  }
  if (path.includes("/contacts")) {
    if (leads === 0)
      return "Your pipeline is empty. Every sale starts with a name — add your first contact and begin building momentum.";
    return `${leads} contact${leads !== 1 ? "s" : ""} in your database. Ask your Sales Operator to identify the highest-priority follow-ups.`;
  }
  if (path.includes("/automations")) {
    return "Automations compound your effort. Build your first follow-up sequence before leads go cold.";
  }
  if (score < 40)
    return `Your health score is ${score}/100. Run 3 more Bylda tools this week to build momentum at ${stage} stage.`;
  if (score < 70)
    return `Building at ${stage} stage — ${runs} tools complete, health ${score}/100. ${leads === 0 ? "Adding contacts is your biggest gap right now." : "Keep your execution cadence tight."}`;
  return `Strong signal at ${stage} stage. Health score ${score}/100 — Bylda is tracking your progress.`;
}

export function ByldaBar() {
  const { currentOrgId } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const orgQ = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const runsQ = useQuery({ ...toolRunsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const leadsQ = useQuery({ ...leadsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const stage = (orgQ.data?.stage as string) ?? "Idea";
  const stageIdx = STAGES.indexOf(stage);
  const runs = runsQ.data?.length ?? 0;
  const leads = leadsQ.data?.length ?? 0;
  const score = computeScore(runs, leads, Math.max(0, stageIdx));

  const mood: ByldaMood = score >= 70 ? "active" : score >= 40 ? "thinking" : "alert";

  const isLoading = orgQ.isLoading && runsQ.isLoading;
  const directive = isLoading
    ? "Analysing your business data..."
    : byldaDirective(path, stage, score, runs, leads);

  return (
    <div
      className="bylda-bar flex items-center gap-3 shrink-0"
      style={{
        height: "48px",
        paddingLeft: "24px",
        paddingRight: "24px",
      }}
    >
      <ByldaAvatar size="sm" mood={mood} />
      <p
        className="flex-1 truncate font-medium caret"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          color: "var(--foreground)",
          letterSpacing: "-0.01em",
        }}
      >
        {directive}
      </p>
      <Link
        to="/app/mentor"
        className="bylda-bar-cta shrink-0 rounded-lg font-medium transition-colors"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          padding: "4px 12px",
        }}
      >
        Talk to Bylda
      </Link>
    </div>
  );
}
