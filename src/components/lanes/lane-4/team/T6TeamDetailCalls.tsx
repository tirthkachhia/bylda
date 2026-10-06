import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, DataBoundary, SkeletonBlock, SystemState, cn } from "@/components/bylda";
import { useCalls, type Call } from "@/lib/data";
import { CALL_TYPE_LABEL, clock } from "../rep/repFormat";
import { OutcomeTag } from "./repProfile";
import { firstNameOf } from "./repProfileFormat";
import { TeamDetailFrame, TeamTable, rowClass } from "./teamDetail";
import { teamError, type TeamView } from "./teamData";

/**
 * T6 · Team Detail — Calls
 * Figma 52:3276 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId/calls
 * Hooks: useCalls — see src/lib/data/README.md
 */
export function T6TeamDetailCalls() {
  return <TeamDetailFrame tab="calls">{(v) => <TeamCalls view={v} />}</TeamDetailFrame>;
}

type Filter = "all" | "review" | "value" | "lost" | "won";

/**
 * "High coaching value" = the top quarter of the team's scored calls, so the chip follows the
 * data instead of a made-up cutoff. "Needs review" = the call's top moment is a regression.
 */
function highValueCutoff(calls: Call[]): number | null {
  const v = calls.map((c) => c.coachingValue).filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  const s = v.sort((a, b) => b - a);
  return s[Math.max(0, Math.ceil(s.length / 4) - 1)];
}

function matches(c: Call, f: Filter, cutoff: number | null) {
  switch (f) {
    case "all":
      return true;
    case "review":
      return c.topMoment?.tone === "regress";
    case "value":
      return cutoff !== null && c.coachingValue !== null && c.coachingValue >= cutoff;
    case "lost":
      return c.outcome === "lost";
    case "won":
      return c.outcome === "won";
  }
}

function TeamCalls({ view }: { view: TeamView }) {
  const calls = useCalls();
  const [filter, setFilter] = useState<Filter>("all");
  const repIds = new Set(view.reps.map((r) => r.id));
  // Ranked by coaching value (Dev Handoff: coaching_value drives ranking in Calls); unscored last.
  const team = calls.data
    ?.filter((c) => repIds.has(c.repId))
    .sort((a, b) => (b.coachingValue ?? -1) - (a.coachingValue ?? -1));
  return (
    <DataBoundary
      query={{ ...calls, data: team, isEmpty: !!team && team.length === 0 }}
      loading={<SkeletonBlock height={360} />}
      error={(e) => teamError("TEAM · CALLS", e, () => void calls.refetch())}
      empty={
        <SystemState
          eyebrow="TEAM · NO CALLS YET"
          title="No calls from this team yet."
          body="Calls land here as soon as a connected source syncs them."
          actions={[{ label: "Check connections", variant: "ghost", href: "/app/connections" }]}
        />
      }
    >
      {(rows) => {
        const cutoff = highValueCutoff(rows);
        const n = (f: Filter) => rows.filter((c) => matches(c, f, cutoff)).length;
        const chips: { key: Filter; label: string }[] = [
          { key: "all", label: `All · ${rows.length}` },
          { key: "review", label: `Needs review · ${n("review")}` },
          { key: "value", label: `High coaching value · ${n("value")}` },
          { key: "lost", label: `Lost · ${n("lost")}` },
          { key: "won", label: `Won · ${n("won")}` },
        ];
        const shown = rows.filter((c) => matches(c, filter, cutoff));
        return (
          <>
            <div role="tablist" aria-label="Filter calls" className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "type-ui-small rounded-by-pill border border-by-border-engraved px-2.5 py-[5px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-by-focus-ring",
                    filter === c.key
                      ? "bg-by-surface-rail text-by-text-on-dark"
                      : "bg-by-surface-raised text-by-text-secondary hover:text-by-text-primary",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <TeamTable
              label="Team calls"
              headers={["CALL", "REP", "WHY IT MATTERS", "OUTCOME", "LENGTH", ""]}
              cols={Object.values(COLS)}
            >
              {shown.length === 0 ? (
                <p className="type-ui-small px-4 py-6 text-by-text-secondary">
                  No calls match this filter.
                </p>
              ) : (
                shown.map((c) => <CallRow key={c.id} call={c} />)
              )}
            </TeamTable>
          </>
        );
      }}
    </DataBoundary>
  );
}

const COLS = {
  call: "w-[230px] shrink-0",
  rep: "w-[130px] shrink-0",
  why: "w-[320px] shrink-0",
  outcome: "w-[110px] shrink-0",
  length: "w-[80px] shrink-0",
  open: "w-[80px] shrink-0",
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function why(c: Call): string {
  if (c.status === "processing") return "Processing";
  if (c.status === "failed") return "Analysis failed";
  return c.topMoment?.label ?? "Nothing notable";
}

function CallRow({ call: c }: { call: Call }) {
  return (
    <Link
      to="/app/calls/$callId"
      params={{ callId: c.id }}
      className={cn(rowClass, "min-w-[960px] py-2.5")}
    >
      <span className={cn("flex flex-col", COLS.call)}>
        <span className="type-ui-body-strong truncate text-by-text-primary">{c.account.name}</span>
        <span className="type-mono-micro text-by-text-tertiary">
          {`${WEEKDAY.format(new Date(c.startedAt))} · ${c.stageAtCall ?? CALL_TYPE_LABEL[c.type]}`}
        </span>
      </span>
      <span className={cn("flex items-center gap-2", COLS.rep)}>
        <Avatar name={c.repName} size={22} />
        <span className="type-ui-body truncate text-by-text-primary">{firstNameOf(c.repName)}</span>
      </span>
      <span className={cn("type-ui-small truncate pr-3 text-by-text-primary", COLS.why)}>
        {why(c)}
      </span>
      <span className={COLS.outcome}>
        <OutcomeTag outcome={c.outcome} />
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.length)}>
        {c.status === "processing" ? "—" : clock(c.durationSec)}
      </span>
      <span className={cn("type-ui-small text-by-text-primary", COLS.open)}>Open</span>
    </Link>
  );
}
