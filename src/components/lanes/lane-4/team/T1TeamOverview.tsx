import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, DataBoundary, SkeletonBar, SkeletonBlock, Tag, cn } from "@/components/bylda";
import {
  useCoachingFoci,
  useRepSummary,
  useViewer,
  type CoachingFocus,
  type Person,
} from "@/lib/data";
import { LocalSparkline } from "../rep/LocalSparkline";
import { directionTone } from "../rep/repFormat";
import { Dash, NoReps, TeamTable, rowClass } from "./teamDetail";
import { teamError, useTeamView } from "./teamData";
import { repDemo, type RepDemo } from "./teamDemo";
import { ATTENTION, currentFocus, focusLine, needsCoaching, overviewHeadline } from "./teamFormat";

/**
 * T1 · Team Overview
 * Figma 12:2 (page 1:10) · Lane 4 — Dravin · route /app/team
 * Hooks: useTeams, useTeam — see src/lib/data/README.md
 *
 * The viewer's own team. Roster order, never ranked: "Not a leaderboard — reps never see this view."
 */
export function T1TeamOverview() {
  const viewer = useViewer();
  const teamId = viewer.data?.team?.id ?? "";
  const view = useTeamView(teamId);
  return (
    <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">
      <DataBoundary
        query={{
          ...view,
          isLoading: view.isLoading || viewer.isLoading,
          error: viewer.error ?? view.error,
        }}
        loading={<OverviewSkeleton />}
        error={(e) => teamError("TEAM · OVERVIEW", e, view.refetch)}
        empty={<NoReps />}
      >
        {(v) =>
          v.reps.length === 0 ? <NoReps /> : <Overview teamName={v.team.name} reps={v.reps} />
        }
      </DataBoundary>
    </div>
  );
}

type Filter = "all" | "needs" | "improving" | "declining";

function Overview({ teamName, reps }: { teamName: string; reps: Person[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const foci = useCoachingFoci();
  const rows = reps.map((rep) => ({ rep, demo: repDemo(rep.id) }));
  const hasDemo = rows.some((r) => r.demo);
  const count = (f: Filter) => rows.filter((r) => matches(r.demo, f)).length;
  const needs = count("needs");
  const improving = count("improving");
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All reps · ${reps.length}` },
    // GAP: attention / trajectory have no field (LANE_REQUESTS L4-1) — filters exist only with data
    ...(hasDemo
      ? ([
          { key: "needs", label: `Needs coaching · ${needs}` },
          { key: "improving", label: `Improving · ${improving}` },
          { key: "declining", label: `Declining · ${count("declining")}` },
        ] as const)
      : []),
  ];
  const shown = rows.filter((r) => matches(r.demo, filter));
  return (
    <>
      <header className="flex items-end gap-3 max-[1180px]:flex-col max-[1180px]:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="type-mono-micro text-by-text-tertiary">
            {`TEAM · ${teamName.toUpperCase()} · ${reps.length} ${reps.length === 1 ? "REP" : "REPS"}`}
          </p>
          <h1 className="type-editorial-h1 max-w-[560px] text-by-text-primary">
            {hasDemo ? overviewHeadline(needs, improving) : `Where each rep on ${teamName} stands.`}
          </h1>
        </div>
        <div role="tablist" aria-label="Filter reps" className="flex shrink-0 gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "type-ui-small rounded-by-pill border border-by-border-engraved px-2.5 py-[5px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
                filter === f.key
                  ? "bg-by-surface-rail text-by-text-on-dark"
                  : "bg-by-surface-raised text-by-text-secondary hover:text-by-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>
      <TeamTable
        label="Reps"
        headers={[
          "REP",
          "ATTENTION",
          "CURRENT FOCUS",
          "TRAJECTORY · 8 WKS",
          "RECENT CHANGE",
          "CALLS · 30D",
        ]}
        cols={[COLS.rep, COLS.attention, COLS.focus, COLS.trajectory, COLS.change, COLS.calls]}
      >
        {shown.length === 0 ? (
          <p className="type-ui-small px-4 py-6 text-by-text-secondary">
            No reps match this filter.
          </p>
        ) : (
          shown.map(({ rep, demo }) => (
            <RepRow
              key={rep.id}
              rep={rep}
              demo={demo}
              focus={foci.data ? currentFocus(foci.data, rep.id) : null}
            />
          ))
        )}
      </TeamTable>
      <p className="type-ui-small text-by-text-tertiary">
        Trajectory = composite of the behaviors your methodology marks as important, per rep,
        against their own baseline. Not a leaderboard — reps never see this view.
      </p>
    </>
  );
}

function matches(demo: RepDemo | null, f: Filter) {
  if (f === "all") return true;
  if (!demo) return false;
  if (f === "needs") return needsCoaching(demo.attention);
  if (f === "improving") return demo.trajectory?.direction === "improving";
  return demo.trajectory?.direction === "regressing";
}

const COLS = {
  rep: "w-[210px] shrink-0",
  attention: "w-[130px] shrink-0",
  focus: "w-[220px] shrink-0",
  trajectory: "w-[150px] shrink-0",
  change: "w-[220px] shrink-0",
  calls: "w-[80px] shrink-0",
};

function RepRow({
  rep,
  demo,
  focus,
}: {
  rep: Person;
  demo: RepDemo | null;
  focus: CoachingFocus | null;
}) {
  const summary = useRepSummary(rep.id);
  const att = demo ? ATTENTION[demo.attention] : null;
  return (
    <Link
      to="/app/team/reps/$repId"
      params={{ repId: rep.id }}
      className={cn(rowClass, "min-w-[960px] py-3")}
    >
      <span className={cn("flex h-6 items-center gap-2.5", COLS.rep)}>
        <Avatar name={rep.name} src={rep.avatarUrl} size={26} />
        <span className="type-ui-body-strong truncate text-by-text-primary">{rep.name}</span>
      </span>
      <span className={COLS.attention}>
        {att && demo ? (
          <Tag tone={att.tone}>
            {demo.attention === "new" ? `${att.label} · ${demo.tenure}` : att.label}
          </Tag>
        ) : (
          <Dash />
        )}
      </span>
      <span className={cn("type-ui-small truncate pr-3", COLS.focus)}>
        {focus ? (
          <span className="text-by-text-primary">{focusLine(focus)}</span>
        ) : (
          <span className="text-by-text-tertiary">— none assigned</span>
        )}
      </span>
      <span className={cn("pr-4", COLS.trajectory)}>
        {demo?.trajectory ? (
          <LocalSparkline
            sparkline={demo.trajectory.sparkline}
            tone={directionTone(demo.trajectory.direction)}
            className="h-5 w-[110px]"
          />
        ) : (
          <Dash />
        )}
      </span>
      <span className={cn("type-ui-small truncate pr-3 text-by-text-secondary", COLS.change)}>
        {demo ? demo.recentChange : <Dash />}
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.calls)}>
        {summary.data ? summary.data.analyzedCalls : "—"}
      </span>
    </Link>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <SkeletonBar width={200} height={10} />
      <SkeletonBar width={520} height={34} />
      <SkeletonBlock height={480} />
    </div>
  );
}
