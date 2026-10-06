import { Link } from "@tanstack/react-router";
import { DataBoundary, SkeletonBlock, StateError, Tag } from "@/components/bylda";
import { useOutcomeAssociations } from "@/lib/data";
import { OutcomeGraph } from "./graph/OutcomeGraph";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { isForbidden } from "./shared/model";
import { strongestAssociation } from "./shared/outcomes";

/**
 * I6 · Behavioral Outcome Graph
 * Figma 28:857 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/graph
 *
 * A concept screen, tagged as one ("not the MVP homepage"): how every behavior links, in
 * context, to what happened next and to what changed after coaching. Only the behavior → outcome
 * link is live — the strongest association that cleared n_closed 30 at Medium confidence or
 * better, dashed because it is an association. Everything else shows what Bylda stores. Manager
 * only (the hook refuses a rep → restricted state). Hook: useOutcomeAssociations.
 */
export function I6BehavioralOutcomeGraph() {
  const associations = useOutcomeAssociations();

  if (isForbidden(associations)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow="INTELLIGENCE · OUTCOME GRAPH" />
      </IntelligenceFrame>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col gap-5 bg-by-surface-rail px-9 pb-7 pt-7 max-[1024px]:px-6">
      <Link
        to="/app/intelligence/matrix"
        className="type-mono-micro text-by-text-on-dark-muted hover:text-by-text-on-dark"
      >
        ← OUTCOME PATTERNS
      </Link>

      <header className="flex flex-col items-start gap-3">
        <h1 className="type-display-l text-by-text-on-dark">BEHAVIORAL OUTCOME GRAPH</h1>
        <Tag tone="info">CONCEPT / FUTURE — NOT THE MVP HOMEPAGE</Tag>
        <p className="type-ui-body max-w-[760px] text-by-text-on-dark-muted">
          Architectural direction: every behavior, in context, linked to what happened next — and to
          what changed after coaching. The moat is this graph accumulating over time, not any single
          screen.
        </p>
      </header>

      <DataBoundary
        query={associations}
        loading={<SkeletonBlock height={560} className="rounded-by-card" />}
        error={() => (
          <StateError
            eyebrow="INTELLIGENCE · OUTCOME GRAPH"
            body="Bylda couldn’t load the outcome associations. Your calls are safe — try again."
            onRetry={() => void associations.refetch()}
          />
        )}
        // No associations at all is not an error: the graph still shows what Bylda stores.
        empty={<OutcomeGraph link={null} />}
      >
        {(rows) => <OutcomeGraph link={strongestAssociation(rows)} />}
      </DataBoundary>

      <aside className="flex max-w-[560px] flex-col gap-1.5 rounded-by-control border border-by-border-rail bg-by-surface-sidebar px-[18px] py-3.5">
        <p className="type-ui-small text-by-text-on-dark">
          — Dashed = statistical association with stated confidence; never drawn solid until
          validated by a coaching intervention.
        </p>
        <p className="type-ui-small text-by-text-on-dark">
          — Read path: Rep → exhibits behavior → during objection → within context → associated with
          outcome → coaching → behavior changes → subsequent outcomes measured.
        </p>
        <p className="type-ui-small text-by-text-on-dark">
          — V1 stores the nodes and edges (events, calls, outcomes, coaching). Graph views ship only
          when data volume supports them. Only the behavior → outcome link above carries live data
          today; the other boxes show what each one holds.
        </p>
      </aside>
    </div>
  );
}
