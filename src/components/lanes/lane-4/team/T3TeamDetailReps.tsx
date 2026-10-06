import { Link } from "@tanstack/react-router";
import { Avatar, Tag, cn } from "@/components/bylda";
import { useCoachingFoci, useRepSummary, type CoachingFocus, type Person } from "@/lib/data";
import { Dash, NoReps, TeamDetailFrame, TeamTable, rowClass } from "./teamDetail";
import { repDemo } from "./teamDemo";
import { ATTENTION, currentFocus, focusLine } from "./teamFormat";

/**
 * T3 · Team Detail — Reps
 * Figma 52:2125 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId/reps
 * Hooks: useTeamMembers — see src/lib/data/README.md
 */
export function T3TeamDetailReps() {
  return (
    <TeamDetailFrame tab="reps">
      {(v) => (v.reps.length === 0 ? <NoReps /> : <RepsTable reps={v.reps} />)}
    </TeamDetailFrame>
  );
}

const COLS = {
  rep: "w-[200px] shrink-0",
  role: "w-[100px] shrink-0",
  tenure: "w-[90px] shrink-0",
  calls: "w-[90px] shrink-0",
  focus: "w-[220px] shrink-0",
  status: "w-[120px] shrink-0",
  open: "w-[80px] shrink-0",
};

function RepsTable({ reps }: { reps: Person[] }) {
  const foci = useCoachingFoci();
  return (
    <TeamTable
      label="Reps"
      headers={["REP", "ROLE", "TENURE", "CALLS 30D", "FOCUS", "STATUS", ""]}
      cols={Object.values(COLS)}
      minWidth="min-w-[900px]"
    >
      {reps.map((r) => (
        <RepRow key={r.id} rep={r} focus={foci.data ? currentFocus(foci.data, r.id) : null} />
      ))}
    </TeamTable>
  );
}

/** "Account Executive" → "AE"; anything else as written. */
const roleShort = (title: string | null) =>
  title === "Account Executive" ? "AE" : title === "Senior Account Executive" ? "Senior AE" : title;

function RepRow({ rep, focus }: { rep: Person; focus: CoachingFocus | null }) {
  const summary = useRepSummary(rep.id);
  const demo = repDemo(rep.id);
  const att = demo ? ATTENTION[demo.attention] : null;
  return (
    <div className={cn(rowClass, "min-w-[900px] py-2.5")}>
      <span className={cn("flex items-center gap-2.5", COLS.rep)}>
        <Avatar name={rep.name} src={rep.avatarUrl} size={22} />
        <span className="type-ui-body-strong truncate text-by-text-primary">{rep.name}</span>
      </span>
      <span className={cn("type-ui-small truncate pr-2 text-by-text-primary", COLS.role)}>
        {roleShort(rep.title) ?? <Dash />}
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.tenure)}>
        {/* GAP: tenure — no start date on Person (LANE_REQUESTS #32 a) — mocks only */}
        {demo ? demo.tenure : "—"}
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.calls)}>
        {summary.data ? summary.data.analyzedCalls : "—"}
      </span>
      <span className={cn("type-ui-small truncate pr-3 text-by-text-primary", COLS.focus)}>
        {focus ? focus.status === "held" ? focusLine(focus) : focus.behaviorName : <Dash />}
      </span>
      <span className={COLS.status}>{att ? <Tag tone={att.tone}>{att.label}</Tag> : <Dash />}</span>
      <Link
        to="/app/team/reps/$repId"
        params={{ repId: rep.id }}
        className={cn(
          "type-ui-small text-by-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
          COLS.open,
        )}
        aria-label={`Open ${rep.name}`}
      >
        Open
      </Link>
    </div>
  );
}
