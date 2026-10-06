import { DataBoundary, SkeletonBlock, SystemState, Tag, cn } from "@/components/bylda";
import {
  useBehaviors,
  useRepComparison,
  useTeamBehaviors,
  type RepComparison,
  type TeamBehaviorRow,
} from "@/lib/data";
import { firstNameOf } from "./repProfileFormat";
import { TeamDetailFrame } from "./teamDetail";
import { teamError, type TeamView } from "./teamData";
import { formatValue, versusMedian, type Versus } from "./teamFormat";

/**
 * T4 · Team Detail — Behaviors
 * Figma 52:2520 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId/behaviors
 * Hooks: useTeam, useBehaviors — see src/lib/data/README.md
 */
export function T4TeamDetailBehaviors() {
  return (
    <TeamDetailFrame tab="behaviors">
      {(v) => (
        <>
          <StrengthsAndFocus />
          <Heatmap view={v} />
        </>
      )}
    </TeamDetailFrame>
  );
}

/** Improving behaviors are strengths; regressing ones are focus areas. Steady ones aren't listed. */
function StrengthsAndFocus() {
  const rows = useTeamBehaviors();
  return (
    <DataBoundary
      query={rows}
      loading={<SkeletonBlock height={240} />}
      error={(e) => teamError("TEAM · BEHAVIORS", e, () => void rows.refetch())}
      empty={
        <SystemState
          eyebrow="TEAM · BEHAVIORS"
          title="No behavior data yet."
          body="Behaviors appear once enough of this team’s calls are analyzed."
        />
      }
    >
      {(all) => (
        <div className="grid w-full grid-cols-2 gap-5 max-[1180px]:grid-cols-1">
          <BehaviorList
            title="STRENGTHS"
            rows={all.filter((r) => r.direction === "improving")}
            tag={{ label: "Strength", tone: "improve" }}
            none="No behavior is clearly improving yet."
          />
          <BehaviorList
            title="FOCUS AREAS"
            rows={all.filter((r) => r.direction === "regressing")}
            tag={{ label: "Focus", tone: "regress" }}
            none="Nothing is slipping right now."
          />
        </div>
      )}
    </DataBoundary>
  );
}

function BehaviorList({
  title,
  rows,
  tag,
  none,
}: {
  title: string;
  rows: TeamBehaviorRow[];
  tag: { label: string; tone: "improve" | "regress" };
  none: string;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
    >
      <p className="type-ui-label text-by-text-primary">{title}</p>
      {rows.length === 0 ? (
        <p className="type-ui-small py-2 text-by-text-secondary">{none}</p>
      ) : (
        rows.map((r) => (
          <div
            key={r.behaviorKey}
            className="flex items-center gap-2 border-b border-by-border-engraved py-2"
            title={`n = ${r.sampleSize} calls`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="type-ui-body-strong truncate text-by-text-primary">{r.name}</span>
              <span className="type-ui-small text-by-text-secondary">
                {[r.valueLabel, r.changeLabel !== "—" ? `${r.changeLabel} in 30 days` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <Tag tone={tag.tone}>{tag.label}</Tag>
          </div>
        ))
      )}
    </section>
  );
}

const CELL: Record<Versus, string> = {
  better: "bg-by-signal-improve-bg text-by-signal-improve",
  worse: "bg-by-signal-regress-bg text-by-signal-regress",
  neutral: "bg-by-surface-inset text-by-text-tertiary",
};

/** Rep × behavior, each cell vs the team median. Manager-only (the data layer refuses reps). */
function Heatmap({ view }: { view: TeamView }) {
  const cmp = useRepComparison(view.team.id);
  const behaviors = useBehaviors();
  const teamRows = useTeamBehaviors();
  return (
    <section
      aria-label="Rep × behavior heatmap"
      className="flex w-full flex-col gap-2 overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
    >
      <div className="flex items-center">
        <p className="type-ui-label flex-1 text-by-text-primary">REP × BEHAVIOR HEATMAP</p>
        <p className="type-mono-micro text-by-text-tertiary">vs team median</p>
      </div>
      <DataBoundary
        query={cmp}
        loading={<SkeletonBlock height={200} />}
        error={(e) => teamError("TEAM · HEATMAP", e, () => void cmp.refetch())}
        empty={
          <p className="type-ui-small py-2 text-by-text-secondary">
            Not enough analyzed calls per rep to compare yet.
          </p>
        }
      >
        {(c) => (
          <HeatGrid
            cmp={c}
            names={(id) => {
              const p = view.people.find((x) => x.id === id);
              return p ? firstNameOf(p.name) : "—";
            }}
            higher={(k) => behaviors.data?.find((b) => b.key === k)?.higherIsBetter}
            unit={(k) => teamRows.data?.find((r) => r.behaviorKey === k)?.unit}
          />
        )}
      </DataBoundary>
    </section>
  );
}

function HeatGrid({
  cmp,
  names,
  higher,
  unit,
}: {
  cmp: RepComparison;
  names: (repId: string) => string;
  higher: (behaviorKey: string) => boolean | undefined;
  unit: (behaviorKey: string) => TeamBehaviorRow["unit"] | undefined;
}) {
  return (
    <div className="flex min-w-max flex-col gap-2">
      <div className="flex gap-1">
        <span className="w-[100px] shrink-0" />
        {cmp.rows.map((r) => (
          <span
            key={r.behaviorKey}
            className="type-mono-micro w-[140px] truncate pr-2 text-by-text-tertiary"
          >
            {r.name}
          </span>
        ))}
      </div>
      {cmp.repIds.map((repId) => (
        <div key={repId} className="flex items-center gap-1">
          <span className="type-ui-small w-[100px] shrink-0 truncate text-by-text-primary">
            {names(repId)}
          </span>
          {cmp.rows.map((r) => {
            const cell = r.values.find((x) => x.repId === repId);
            const vals = r.values.map((x) => x.value);
            const v = cell
              ? versusMedian(
                  cell.value,
                  r.teamMedian,
                  Math.max(...vals) - Math.min(...vals),
                  higher(r.behaviorKey),
                )
              : "neutral";
            return (
              <span
                key={r.behaviorKey}
                title={
                  cell
                    ? `${formatValue(cell.value, unit(r.behaviorKey))} · team median ${formatValue(r.teamMedian, unit(r.behaviorKey))} · n = ${cell.n}`
                    : "No data"
                }
                className={cn(
                  "type-mono-micro flex h-8 w-[140px] items-start rounded-by-control px-2.5 py-2",
                  CELL[v],
                )}
              >
                {v === "neutral" ? "—" : v}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
