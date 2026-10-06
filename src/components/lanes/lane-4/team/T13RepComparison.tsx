import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Avatar,
  Button,
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  SystemState,
  cn,
} from "@/components/bylda";
import {
  useBehaviors,
  useMethodologies,
  useRepComparison,
  useTeamBehaviors,
  useTeamMembers,
  useViewer,
  type RepComparison,
} from "@/lib/data";
import { firstNameOf } from "./repProfileFormat";
import { activeMethodology, teamError } from "./teamData";
import { SuggestionMark } from "./teamDetail";
import { VERSUS_TEXT, formatValue, versusMedian } from "./teamFormat";

/**
 * T13 · Rep Comparison
 * Figma 29:1629 (page 1:10) · Lane 4 — Dravin · route /app/team/compare
 * Hooks: useRepComparison — see src/lib/data/README.md
 *
 * MANAGER-ONLY. The data layer refuses it to reps (FORBIDDEN_FOR_ROLE → Y9). For coaching
 * decisions, not rankings: columns keep the source order, never sorted by a score.
 */
/**
 * "+ Add rep" and the behavior-set menu. The hook takes no selection yet (L4-1), so a click says
 * so instead of pretending to change the table.
 */
function CompareControls() {
  const methodologies = useMethodologies();
  const meth = activeMethodology(methodologies.data);
  const [note, setNote] = useState<string | null>(null);
  const set = meth
    ? meth.template === "custom"
      ? meth.name
      : meth.template.toUpperCase()
    : "Methodology";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setNote("Choosing reps isn’t available yet.")}>
          + Add rep
        </Button>
        <Button
          variant="secondary"
          onClick={() => setNote("Choosing a behavior set isn’t available yet.")}
        >
          {`Behaviors: ${set} set ⌄`}
        </Button>
      </div>
      {note ? (
        <p role="status" className="type-ui-small text-by-text-secondary">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function T13RepComparison() {
  const viewer = useViewer();
  const teamId = viewer.data?.team?.id ?? "";
  const cmp = useRepComparison(teamId);
  return (
    <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">
      <p className="type-mono-micro whitespace-pre text-by-text-tertiary">
        <Link to="/app/team" className="hover:text-by-text-primary">
          TEAM
        </Link>
        {"  /  COMPARE"}
      </p>
      <header className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="type-editorial-h1 text-by-text-primary">
            Compare reps on the behaviors that matter
          </h1>
          <p className="type-ui-small text-by-text-secondary">
            For coaching decisions, not rankings. Reps never see this view.
          </p>
        </div>
        {/* GAP: useRepComparison takes no rep or behavior-set selection (LANE_REQUESTS L4-1) */}
        <CompareControls />
      </header>
      <DataBoundary
        query={{ ...cmp, isLoading: cmp.isLoading || viewer.isLoading }}
        loading={
          <div className="flex flex-col gap-5" aria-busy>
            <SkeletonBlock height={340} />
            <SkeletonBar width={480} height={12} />
          </div>
        }
        error={(e) => teamError("TEAM · COMPARE", e, () => void cmp.refetch())}
        empty={
          <SystemState
            eyebrow="TEAM · NOT ENOUGH CALLS YET"
            tag={{ tone: "attention", label: "Low evidence" }}
            title="Not enough analyzed calls to compare reps yet."
            body="Comparisons appear once each rep has enough analyzed calls on the same behaviors."
          />
        }
      >
        {(c) => <Comparison cmp={c} />}
      </DataBoundary>
    </div>
  );
}

function Comparison({ cmp }: { cmp: RepComparison }) {
  const people = useTeamMembers(null);
  const behaviors = useBehaviors();
  const teamRows = useTeamBehaviors();
  const name = (id: string) => people.data?.find((p) => p.id === id)?.name ?? "—";
  const higher = (k: string) => behaviors.data?.find((b) => b.key === k)?.higherIsBetter;
  const unit = (k: string) => teamRows.data?.find((r) => r.behaviorKey === k)?.unit;
  const ns = cmp.rows.flatMap((r) => r.values.map((v) => v.n));
  const pairing = cmp.suggestedPairing;
  const pairN = (id: string) =>
    Math.max(0, ...cmp.rows.flatMap((r) => r.values.filter((v) => v.repId === id).map((v) => v.n)));
  return (
    <>
      <section
        aria-label="Rep comparison"
        className="flex w-full flex-col overflow-x-auto rounded-by-card border border-by-border-engraved bg-by-surface-raised"
      >
        <div className="flex min-w-max items-center rounded-t-by-card border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px]">
          <span className="type-mono-micro w-[300px] shrink-0 text-by-text-tertiary">BEHAVIOR</span>
          {cmp.repIds.map((id) => (
            <span key={id} className="flex w-[170px] shrink-0 items-center gap-2">
              <Avatar name={name(id)} size={22} />
              <span className="type-ui-body-strong text-by-text-primary">
                {firstNameOf(name(id))}
              </span>
            </span>
          ))}
        </div>
        {cmp.rows.map((r) => {
          const vals = r.values.map((v) => v.value);
          const range = Math.max(...vals) - Math.min(...vals);
          return (
            <div
              key={r.behaviorKey}
              className="flex min-w-max items-center border-b border-by-border-engraved px-4 py-2.5 last:border-b-0"
            >
              <span className="type-ui-body-strong w-[300px] shrink-0 pr-3 text-by-text-primary">
                {r.name}
              </span>
              {cmp.repIds.map((id) => {
                const cell = r.values.find((v) => v.repId === id);
                if (!cell)
                  return (
                    <span
                      key={id}
                      className="type-mono-data w-[170px] shrink-0 text-by-text-tertiary"
                    >
                      —
                    </span>
                  );
                const vs = versusMedian(cell.value, r.teamMedian, range, higher(r.behaviorKey));
                return (
                  <span
                    key={id}
                    title={`n = ${cell.n} calls · team median ${formatValue(r.teamMedian, unit(r.behaviorKey))}`}
                    className={cn("type-mono-data w-[170px] shrink-0", VERSUS_TEXT[vs])}
                  >
                    {formatValue(cell.value, unit(r.behaviorKey))}
                  </span>
                );
              })}
            </div>
          );
        })}
      </section>
      <section className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3">
        <p className="type-mono-micro text-by-text-tertiary">HOW TO READ</p>
        <p className="type-ui-small text-by-text-primary">
          Green / oxide = notably better / worse than the team median for that behavior. Differences
          under ~10% of the team range show neutral.
          {ns.length > 0
            ? ` Call volume differs (${Math.min(...ns)}–${Math.max(...ns)} calls) — hover any cell for n.`
            : null}
        </p>
      </section>
      {pairing ? (
        <section
          aria-label="Suggested pairing"
          className="flex flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
        >
          <p className="type-mono-micro flex items-center gap-2 text-by-text-secondary">
            <SuggestionMark />
            SUGGESTED PAIRING
          </p>
          <p
            className="type-editorial-insight text-by-text-primary"
            title={`n = ${pairN(pairing.repId)} and ${pairN(pairing.withRepId)} calls`}
          >
            {`Pair ${firstNameOf(name(pairing.repId))} with ${firstNameOf(name(pairing.withRepId))} for a call review: ${lowerFirst(pairing.reason)}`}
          </p>
          <div>
            <Button variant="secondary" asChild>
              <Link to="/app/calls/compare">Build a comparison of 2 calls</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
