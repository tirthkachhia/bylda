import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Button,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  SystemState,
  cn,
  systemStates,
} from "@/components/bylda";
import { useCoachingFoci, useMethodologies } from "@/lib/data";
import {
  activeMethodology,
  methodologyLabel,
  teamError,
  useTeamView,
  type TeamView,
} from "./teamData";
import { teamDemo } from "./teamDemo";
import { useTeamIdParam } from "./teamFormat";

/**
 * Shared pieces for the Team screens T1–T7 and T13 (Figma page 09, 12:2 · 29:1423 · 52:2125 ·
 * 52:2520 · 52:2928 · 52:3276 · 52:3634 · 29:1629). Pure presentation of data-layer values.
 * Every team view is manager-side: the data layer refuses them to reps (FORBIDDEN_FOR_ROLE → Y9).
 */

// ── states ────────────────────────────────────────────────────────────────────

function TeamNotFound() {
  return (
    <SystemState
      eyebrow="TEAM · NOT FOUND"
      title="This team isn’t in your workspace."
      body="It may have been archived, or the link is wrong."
      actions={[{ label: "Back to Team", variant: "ghost", href: "/app/team" }]}
    />
  );
}

/** Y10 — the team exists but has no reps yet. */
export function NoReps() {
  return (
    <SystemState
      {...systemStates.teamNoMembers()}
      actions={[{ label: "Invite reps", variant: "primary", href: "/app/workspace/users" }]}
    />
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <SkeletonBar width={120} height={10} />
      <SkeletonBar width={280} height={30} />
      <SkeletonBar width={360} height={12} />
      <SkeletonBlock height={36} />
      <SkeletonBlock height={320} />
    </div>
  );
}

// ── frame ─────────────────────────────────────────────────────────────────────

export type TeamTab = "overview" | "reps" | "behaviors" | "coaching" | "calls" | "settings";

/**
 * T2–T7 frame: breadcrumb · team name · meta line · actions, then the tab row with counts.
 * T2 (Overview) uses the larger title, the long meta line and Edit team; the other tabs the
 * compact header (Figma 52:2125 ff.). The frame owns loading / error / forbidden / not-found.
 */
export function TeamDetailFrame({
  tab,
  children,
}: {
  tab: TeamTab;
  children: (view: TeamView) => ReactNode;
}) {
  const teamId = useTeamIdParam();
  const view = useTeamView(teamId);
  return (
    <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">
      <DataBoundary
        query={view}
        loading={<HeaderSkeleton />}
        error={(e) => teamError("TEAM · DETAIL", e, view.refetch)}
        empty={<TeamNotFound />}
      >
        {(v) => (
          <>
            <TeamHeader view={v} overview={tab === "overview"} />
            <TeamTabs view={v} active={tab} />
            {children(v)}
          </>
        )}
      </DataBoundary>
    </div>
  );
}

function TeamHeader({ view, overview }: { view: TeamView; overview: boolean }) {
  const { team, people, reps } = view;
  const methodologies = useMethodologies();
  const meth = activeMethodology(methodologies.data);
  const manager = people.find((p) => p.id === team.managerId);
  const demo = teamDemo(team.id);
  const meta = [
    `${reps.length} ${reps.length === 1 ? "rep" : "reps"}`,
    manager ? `Manager: ${manager.name}` : null,
    meth
      ? overview
        ? `Methodology: ${methodologyLabel(meth, true)}`
        : methodologyLabel(meth, false)
      : null,
    // GAP: team start date (LANE_REQUESTS L4-1) — mocks only
    overview && demo ? `Since ${demo.since}` : null,
  ].filter(Boolean);
  return (
    <>
      <p className="type-mono-micro whitespace-pre text-by-text-tertiary">
        <Link to="/app/team" className="hover:text-by-text-primary">
          TEAM
        </Link>
        {"  /  TEAMS  /"}
      </p>
      <header className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1
            className={cn(
              "text-by-text-primary",
              overview ? "type-editorial-h1" : "type-editorial-h2",
            )}
          >
            {team.name}
          </h1>
          <p className="type-ui-small text-by-text-secondary">{meta.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {overview ? (
            <Button variant="secondary" asChild>
              <Link to="/app/team/$teamId/settings" params={{ teamId: team.id }}>
                Edit team
              </Link>
            </Button>
          ) : null}
          <TeamFocusButton />
        </div>
      </header>
    </>
  );
}

/** Opens Assign Coaching (G2). A team-wide focus has no own object yet (LANE_REQUESTS L4-1). */
export function TeamFocusButton({
  behaviorKey,
  label = "Team coaching focus",
}: {
  behaviorKey?: string;
  label?: string;
}) {
  return (
    <Button asChild>
      <Link to="/app/coaching/assign" search={(behaviorKey ? { behaviorKey } : {}) as never}>
        {label}
      </Link>
    </Button>
  );
}

const TABS: { key: TeamTab; label: string; to: string }[] = [
  { key: "overview", label: "Overview", to: "/app/team/$teamId" },
  { key: "reps", label: "Reps", to: "/app/team/$teamId/reps" },
  { key: "behaviors", label: "Behaviors", to: "/app/team/$teamId/behaviors" },
  { key: "coaching", label: "Coaching", to: "/app/team/$teamId/coaching" },
  { key: "calls", label: "Calls", to: "/app/team/$teamId/calls" },
  { key: "settings", label: "Settings", to: "/app/team/$teamId/settings" },
];

function TeamTabs({ view, active }: { view: TeamView; active: TeamTab }) {
  const methodologies = useMethodologies();
  const foci = useCoachingFoci();
  const repIds = new Set(view.reps.map((r) => r.id));
  const meth = activeMethodology(methodologies.data);
  const counts: Partial<Record<TeamTab, number | null>> = {
    reps: view.reps.length,
    behaviors: meth ? meth.behaviors.filter((b) => b.enabled).length : null,
    coaching: foci.data ? foci.data.filter((f) => repIds.has(f.repId)).length : null,
    calls: view.team.analyzedCalls,
  };
  return (
    <nav aria-label="Team" className="flex gap-[18px] border-b border-by-border-engraved">
      {TABS.map((t) => {
        const on = t.key === active;
        const count = counts[t.key];
        return (
          <Link
            key={t.key}
            to={t.to}
            params={{ teamId: view.team.id }}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px flex items-start gap-1.5 border-b-[1.5px] py-2 transition-colors duration-200 ease-out",
              on
                ? "border-by-text-primary text-by-text-primary"
                : "border-transparent text-by-text-secondary hover:text-by-text-primary",
            )}
          >
            <span className={on ? "type-ui-body-strong" : "type-ui-body"}>{t.label}</span>
            {count !== undefined && count !== null ? (
              <span className="type-mono-micro text-by-text-tertiary">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

// ── tables ────────────────────────────────────────────────────────────────────

/** Raised table card with the inset mono header row. `cols` are width utilities, in order. */
export function TeamTable({
  label,
  title,
  headers,
  cols,
  children,
  minWidth = "min-w-[960px]",
}: {
  label: string;
  title?: string;
  headers: string[];
  cols: string[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <section
      aria-label={label}
      className="flex w-full flex-col overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      {title ? <p className="type-ui-label px-4 py-3 text-by-text-primary">{title}</p> : null}
      <div
        className={cn(
          "type-mono-micro flex items-start border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary",
          !title && "rounded-t-by-card",
          minWidth,
        )}
      >
        {headers.map((h, i) => (
          <span key={`${h}-${i}`} className={cols[i]}>
            {h}
          </span>
        ))}
      </div>
      {children}
    </section>
  );
}

export const rowClass =
  "flex items-center border-b border-by-border-engraved px-4 transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover";

/** "—" in tertiary, for a cell with no value. */
export function Dash() {
  return <span className="type-ui-small text-by-text-tertiary">—</span>;
}

/** Raised strip of KPI cells (T2, T5). `value: null` renders "—" and says why. */
export function KpiStrip({
  items,
}: {
  items: { label: string; value: string | null; note: string | null; noteClass?: string }[];
}) {
  return (
    <section
      aria-label="Team numbers"
      className="flex w-full rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      {items.map((k) => (
        <div
          key={k.label}
          className="flex min-w-0 flex-1 flex-col gap-1 border-r border-by-border-engraved px-4 py-3 last:border-r-0"
        >
          <span className="type-mono-micro text-by-text-tertiary">{k.label}</span>
          <span className="type-ui-title text-by-text-primary">{k.value ?? "—"}</span>
          <span className={cn("type-mono-micro", k.noteClass ?? "text-by-text-secondary")}>
            {k.value === null ? "not measured yet" : (k.note ?? " ")}
          </span>
        </div>
      ))}
    </section>
  );
}

/** Figma's outlined triangle before a suggestion label (T2, T13) — info signal, 10×9. */
export function SuggestionMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 9"
      className="h-[9px] w-2.5 shrink-0 text-by-signal-info"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
    >
      <path d="M5 1 L9 8 H1 Z" strokeLinejoin="round" />
    </svg>
  );
}
