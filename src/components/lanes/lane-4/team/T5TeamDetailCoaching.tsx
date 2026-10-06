import { Link } from "@tanstack/react-router";
import { Avatar, DataBoundary, SkeletonBlock, SystemState, Tag, cn } from "@/components/bylda";
import { useCoachingFoci, type CoachingFocus } from "@/lib/data";
import { callDate } from "../rep/repFormat";
import { firstNameOf, focusTag, isActiveFocus } from "./repProfileFormat";
import { KpiStrip, TeamDetailFrame, TeamTable, rowClass } from "./teamDetail";
import { teamError, type TeamView } from "./teamData";
import { daysBetween, median } from "./teamFormat";

/**
 * T5 · Team Detail — Coaching
 * Figma 52:2928 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId/coaching
 * Hooks: useCoachingFoci — see src/lib/data/README.md
 */
export function T5TeamDetailCoaching() {
  return <TeamDetailFrame tab="coaching">{(v) => <TeamCoaching view={v} />}</TeamDetailFrame>;
}

const NINETY_DAYS = 90 * 86_400_000;

function TeamCoaching({ view }: { view: TeamView }) {
  const foci = useCoachingFoci();
  const repIds = new Set(view.reps.map((r) => r.id));
  const mine = {
    ...foci,
    data: foci.data?.filter((f) => repIds.has(f.repId)),
    isEmpty: !!foci.data && !foci.data.some((f) => repIds.has(f.repId)),
  };
  return (
    <DataBoundary
      query={mine}
      loading={<SkeletonBlock height={360} />}
      error={(e) => teamError("TEAM · COACHING", e, () => void foci.refetch())}
      empty={
        <SystemState
          eyebrow="TEAM · NO COACHING YET"
          title="No one on this team has a coaching focus yet."
          body="Assign one from a rep’s profile or from a call. Bylda measures whether it changed."
          actions={[{ label: "Assign coaching", variant: "primary", href: "/app/coaching/assign" }]}
        />
      }
    >
      {(list) => (
        <>
          <CoachingKpis foci={list} />
          <CoachingTable foci={list} />
        </>
      )}
    </DataBoundary>
  );
}

function CoachingKpis({ foci }: { foci: CoachingFocus[] }) {
  const since = Date.now() - NINETY_DAYS;
  const closed = foci.filter((f) => f.result && new Date(f.result.measuredOn).getTime() >= since);
  const held = closed.filter((f) => f.result?.verdict === "held");
  const days = median(held.map((f) => daysBetween(f.assignedAt, f.result!.measuredOn)));
  const reverted = foci.filter((f) => f.status === "reverted");
  return (
    <KpiStrip
      items={[
        { label: "ACTIVE", value: String(foci.filter(isActiveFocus).length), note: null },
        {
          label: "HELD (90D)",
          value: `${held.length} of ${closed.length}`,
          note: closed.length
            ? `${Math.round((held.length / closed.length) * 100)}%`
            : "none measured",
          noteClass: "text-by-signal-improve",
        },
        {
          label: "MEDIAN TIME TO CHANGE",
          value:
            days === null ? "—" : `${Math.round(days)} ${Math.round(days) === 1 ? "day" : "days"}`,
          note: days === null ? "no focus held yet" : null,
        },
        {
          label: "REVERTED",
          value: String(reverted.length),
          note: reverted[0]
            ? `${firstNameOf(reverted[0].repName)} · ${reverted[0].behaviorName.toLowerCase()}`
            : null,
          noteClass: "text-by-signal-regress",
        },
      ]}
    />
  );
}

const COLS = {
  rep: "w-[200px] shrink-0",
  focus: "w-[260px] shrink-0",
  status: "w-[160px] shrink-0",
  change: "w-[180px] shrink-0",
  checkIn: "w-[120px] shrink-0",
};

/** Figma T5 order: in flight, then waiting on the rep, then measured. Never by rep. */
const STAGE: Record<CoachingFocus["status"], number> = {
  measuring: 0,
  acknowledged: 0,
  not_yet: 1,
  assigned: 2,
  held: 3,
  reverted: 3,
};
const order = (a: CoachingFocus, b: CoachingFocus) =>
  STAGE[a.status] - STAGE[b.status] || b.assignedAt.localeCompare(a.assignedAt);

function CoachingTable({ foci }: { foci: CoachingFocus[] }) {
  return (
    <TeamTable
      label="Team coaching"
      title="TEAM COACHING"
      headers={["REP", "FOCUS", "STATUS", "CHANGE", "CHECK-IN"]}
      cols={Object.values(COLS)}
      minWidth="min-w-[920px]"
    >
      {[...foci].sort(order).map((f) => {
        // Figma T5 draws a not-yet-acknowledged focus as a neutral outlined tag.
        const tag =
          f.status === "assigned" ? { tone: "neutral" as const, label: "Assigned" } : focusTag(f);
        return (
          <Link
            key={f.id}
            to="/app/coaching/$focusId"
            params={{ focusId: f.id }}
            className={cn(rowClass, "min-w-[920px] py-2.5")}
          >
            <span className={cn("flex items-center gap-2.5", COLS.rep)}>
              <Avatar name={f.repName} size={22} />
              <span className="type-ui-body-strong truncate text-by-text-primary">
                {firstNameOf(f.repName)}
              </span>
            </span>
            <span className={cn("type-ui-small truncate pr-3 text-by-text-primary", COLS.focus)}>
              {f.behaviorName}
            </span>
            <span className={COLS.status}>
              <Tag tone={tag.tone}>{tag.label}</Tag>
            </span>
            <span className={cn("type-mono-data text-by-text-secondary", COLS.change)}>
              {f.result ? `${f.result.baseline} → ${f.result.value}` : "—"}
            </span>
            <span className={cn("type-mono-data text-by-text-secondary", COLS.checkIn)}>
              {checkIn(f)}
            </span>
          </Link>
        );
      })}
    </TeamTable>
  );
}

/** Done once measured; otherwise the judge-after date, or "after N calls". */
function checkIn(f: CoachingFocus): string {
  if (f.result) return "Done";
  if (f.judgeAfter.date) {
    return new Date(f.judgeAfter.date).getTime() < Date.now()
      ? "Overdue"
      : callDate(f.judgeAfter.date);
  }
  return f.judgeAfter.calls ? `after ${f.judgeAfter.calls} calls` : "—";
}
