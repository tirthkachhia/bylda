import { useState } from "react";
import {
  Avatar,
  Button,
  ConfidenceMeter,
  ContextPanel,
  DataBoundary,
  SkeletonBlock,
  StateError,
  SystemState,
  cn,
} from "@/components/bylda";
import {
  useCoachingFoci,
  useInsights,
  useMethodologies,
  useObjectionLibrary,
  type Direction,
  type Person,
} from "@/lib/data";
import { Dash, KpiStrip, SuggestionMark, TeamDetailFrame, TeamFocusButton } from "./teamDetail";
import { activeMethodology, type TeamView } from "./teamData";
import { teamDemo } from "./teamDemo";
import { firstNameOf } from "./repProfileFormat";

/**
 * T2 · Team Detail — Mid-Market AE (Overview)
 * Figma 29:1423 (page 1:10) · Lane 4 — Dravin · route /app/team/$teamId
 * Hooks: useTeam, useTeamMembers — see src/lib/data/README.md
 */
export function T2TeamDetailMidMarketAE() {
  return (
    <TeamDetailFrame tab="overview">
      {(v) => (
        <>
          <Kpis view={v} />
          <TeamFocusSuggestion />
          <Distribution view={v} />
          <TeamContext view={v} />
        </>
      )}
    </TeamDetailFrame>
  );
}

const DIRECTION_NOTE: Record<Direction, string> = {
  improving: "text-by-signal-improve",
  regressing: "text-by-signal-regress",
  steady: "text-by-text-secondary",
};

function Kpis({ view }: { view: TeamView }) {
  const foci = useCoachingFoci();
  const demo = teamDemo(view.team.id);
  const repIds = new Set(view.reps.map((r) => r.id));
  const monthAgo = Date.now() - 30 * 86_400_000;
  const closed = (foci.data ?? []).filter(
    (f) => repIds.has(f.repId) && f.result && new Date(f.result.measuredOn).getTime() >= monthAgo,
  );
  const held = closed.filter((f) => f.result?.verdict === "held").length;
  const perRep = view.reps.length > 0 ? view.team.callsThisWeek / view.reps.length : null;
  return (
    <KpiStrip
      items={[
        {
          label: "CALLS / REP / WK",
          value: perRep === null ? null : perRep.toFixed(1),
          note: "team average",
        },
        {
          label: "TRAJECTORY",
          // GAP: team trajectory (LANE_REQUESTS L4-1) — mocks only
          value: demo?.kpis.trajectory.value ?? null,
          note: demo?.kpis.trajectory.note ?? null,
          noteClass: demo ? DIRECTION_NOTE[demo.kpis.trajectory.direction] : undefined,
        },
        {
          label: "HELD CONTROL",
          // GAP: team held-control rate (LANE_REQUESTS L4-1) — mocks only
          value: demo?.kpis.heldControl.value ?? null,
          note: demo?.kpis.heldControl.note ?? null,
          noteClass: demo ? DIRECTION_NOTE[demo.kpis.heldControl.direction] : undefined,
        },
        {
          label: "FOCUSES HELD",
          value: foci.data ? `${held} of ${closed.length}` : null,
          note: "closed in 30 days",
        },
      ]}
    />
  );
}

/**
 * The strongest team-level pattern, as a focus suggestion. Confidence + sample size always;
 * low confidence = observation only, no "Create team focus" (§4). Below the team threshold
 * the data layer gates it to "insufficient" → Y3 (§13.13).
 */
function TeamFocusSuggestion() {
  const insights = useInsights({ kind: "pattern" });
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <DataBoundary
      query={insights}
      loading={<SkeletonBlock height={150} />}
      error={() => (
        <StateError
          eyebrow="TEAM FOCUS SUGGESTION"
          body="Couldn’t load team patterns."
          onRetry={() => void insights.refetch()}
        />
      )}
      empty={null}
    >
      {([top]) =>
        top.state === "insufficient" ? (
          <SystemState
            eyebrow="TEAM · NOT ENOUGH CALLS YET"
            tag={{ tone: "attention", label: "Low evidence" }}
            title="Not enough analyzed calls to suggest a team focus."
            body={`${top.callsAnalyzed} of ${top.callsNeeded} calls analyzed.`}
          />
        ) : (
          <section
            aria-label="Team focus suggestion"
            className="flex flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
          >
            <p className="type-mono-micro flex items-center gap-2 text-by-text-secondary">
              <SuggestionMark />
              TEAM FOCUS SUGGESTION
            </p>
            <p className="type-editorial-insight text-by-text-primary">{top.insight.headline}</p>
            <div className="flex items-center gap-2.5">
              <ConfidenceMeter level={top.insight.confidence} />
              <span className="type-mono-micro text-by-text-secondary">
                {[
                  top.insight.affectedRepIds.length > 0
                    ? `affects ${top.insight.affectedRepIds.length} ${top.insight.affectedRepIds.length === 1 ? "rep" : "reps"}`
                    : null,
                  top.insight.sampleLabel ?? `n = ${top.insight.sampleSize}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="flex gap-2">
              {top.insight.confidence !== "low" && top.insight.action ? (
                <TeamFocusButton
                  label="Create team focus"
                  behaviorKey={
                    "behaviorKey" in top.insight.action ? top.insight.action.behaviorKey : undefined
                  }
                />
              ) : null}
              <Button variant="ghost" onClick={() => setDismissed(true)}>
                Not now
              </Button>
            </div>
          </section>
        )
      }
    </DataBoundary>
  );
}

/** Held control in objections, bucketed. Mocks only until the metric exists (L4-1). */
function Distribution({ view }: { view: TeamView }) {
  const demo = teamDemo(view.team.id);
  if (!demo) return null;
  const name = (id: string) => {
    const p = view.reps.find((r) => r.id === id);
    return p ? firstNameOf(p.name) : null;
  };
  return (
    <section
      aria-label="Distribution — held control in objections"
      className="flex w-full flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <p className="type-mono-micro rounded-t-by-card border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary">
        <span className="block w-[260px]">DISTRIBUTION · HELD CONTROL IN OBJECTIONS</span>
      </p>
      {demo.distribution.map((b) => (
        <div
          key={b.label}
          className="type-ui-small flex items-center border-b border-by-border-engraved px-4 py-2.5 text-by-text-primary last:border-b-0"
        >
          <span className="w-[260px] shrink-0">{b.label}</span>
          <span>{b.repIds.map(name).filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ))}
    </section>
  );
}

function TeamContext({ view }: { view: TeamView }) {
  const methodologies = useMethodologies();
  const objections = useObjectionLibrary();
  const meth = activeMethodology(methodologies.data);
  const managers = view.people.filter((p) => p.id === view.team.managerId);
  const delivery = teamDemo(view.team.id)?.delivery;
  return (
    <ContextPanel>
      <PanelHeading>MANAGERS</PanelHeading>
      {managers.length === 0 ? (
        <p className="type-ui-small text-by-text-secondary">No manager assigned.</p>
      ) : (
        managers.map((m) => <ManagerRow key={m.id} person={m} />)
      )}
      <PanelHeading>METHODOLOGY</PanelHeading>
      {meth ? (
        <dl className="flex flex-col">
          <PanelRow label="Framework">
            {meth.template === "custom" ? meth.name : meth.template.toUpperCase()}
          </PanelRow>
          <PanelRow label="Stages">{meth.stages.map((s) => s.name).join(" · ")}</PanelRow>
          <PanelRow label="Behaviors on">{meth.behaviors.filter((b) => b.enabled).length}</PanelRow>
          <PanelRow label="Objections">
            {objections.data ? `${objections.data.length} in library` : <Dash />}
          </PanelRow>
        </dl>
      ) : (
        <p className="type-ui-small text-by-text-secondary">No methodology set.</p>
      )}
      {/* GAP: delivery schedule per team (LANE_REQUESTS L4-1) — mocks only */}
      {delivery ? (
        <>
          <PanelHeading>DELIVERY</PanelHeading>
          <dl className="flex flex-col">
            <PanelRow label="Manager brief">{delivery.managerBrief}</PanelRow>
            <PanelRow label="Rep brief">{delivery.repBrief}</PanelRow>
            <PanelRow label="Room">{delivery.room}</PanelRow>
          </dl>
        </>
      ) : null}
    </ContextPanel>
  );
}

function PanelHeading({ children }: { children: string }) {
  return <p className="type-ui-label text-by-text-primary">{children}</p>;
}

function ManagerRow({ person }: { person: Person }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Avatar name={person.name} src={person.avatarUrl} size={26} />
      <span className="type-ui-small text-by-text-primary">{person.name} · Manager</span>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2.5 border-b border-by-border-engraved py-2")}>
      <dt className="type-mono-micro w-[90px] shrink-0 pt-0.5 text-by-text-tertiary">{label}</dt>
      <dd className="type-ui-small min-w-0 flex-1 text-by-text-primary">{children}</dd>
    </div>
  );
}
