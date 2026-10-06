import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DataBoundary,
  SkeletonBar,
  SkeletonBlock,
  StateError,
  SystemState,
  cn,
} from "@/components/bylda";
import { useObjectionStats, useTeam, useViewer, type ObjectionStat } from "@/lib/data";
import { ObjectionPanel } from "./objections/ObjectionPanel";
import { ObjectionsTable } from "./objections/ObjectionsTable";
import { IntelligenceFrame, RestrictedState } from "./shared/IntelligenceFrame";
import { isForbidden } from "./shared/model";
import { percent, summarizeObjections, type ObjectionSummary } from "./shared/outcomes";

const EYEBROW = "INTELLIGENCE · OBJECTIONS";

/**
 * I4 · Objections
 * Figma 28:378 (page 1:9) · Lane 1 — Ansh · route /app/intelligence/objections
 *
 * How the team handles objections: a strip of team-level numbers, then one row per objection
 * type; selecting a row fills the context panel. Manager-only (the hook refuses a rep → the
 * restricted state). Every row shows confidence + n. Hooks: useObjectionStats (+ useTeam,
 * useViewer).
 */
export function I4Objections() {
  const viewer = useViewer();
  const team = useTeam(viewer.data?.team?.id ?? "");
  const stats = useObjectionStats();
  const [picked, setPicked] = useState<string | null>(null);

  if (isForbidden(stats)) {
    return (
      <IntelligenceFrame>
        <RestrictedState eyebrow={EYEBROW} />
      </IntelligenceFrame>
    );
  }

  const analyzed = team.data?.analyzedCalls ?? null;
  const summary = stats.data ? summarizeObjections(stats.data, analyzed) : null;

  return (
    <IntelligenceFrame>
      <nav
        aria-label="Breadcrumb"
        className="type-mono-micro flex gap-2 whitespace-pre text-by-text-tertiary"
      >
        <Link to="/app/intelligence" className="hover:text-by-text-primary">
          INTELLIGENCE
        </Link>
        <span>/</span>
        <span>OBJECTIONS</span>
      </nav>

      <header className="flex flex-col gap-1.5">
        <h1 className="type-editorial-h1 text-by-text-primary">How the team handles objections</h1>
        <p className="type-ui-small text-by-text-secondary">
          {summary && analyzed != null
            ? `Detected from ${analyzed} calls · ${summary.total} objections`
            : "Detected from your analyzed calls."}
        </p>
      </header>

      <DataBoundary
        query={stats}
        loading={<ObjectionsSkeleton />}
        error={() => (
          <StateError
            eyebrow={EYEBROW}
            body="Bylda couldn’t load the objections. Your calls are safe — try again."
            onRetry={() => void stats.refetch()}
          />
        )}
        empty={
          <SystemState
            eyebrow={EYEBROW}
            tag={{ tone: "neutral", label: "Empty" }}
            title="No objections detected yet."
            body="They show up here once Bylda has analyzed calls where a prospect pushes back."
          />
        }
      >
        {(rows) => {
          const selected: ObjectionStat | null =
            rows.find((r) => r.label === picked) ?? rows[0] ?? null;
          return (
            <>
              {summary ? <SummaryStrip summary={summary} /> : null}
              <ObjectionsTable
                stats={rows}
                selectedLabel={selected?.label ?? null}
                onSelect={setPicked}
              />
              {selected ? <ObjectionPanel stat={selected} /> : null}
            </>
          );
        }}
      </DataBoundary>
    </IntelligenceFrame>
  );
}

/**
 * Figma 28:476. Three team-level numbers, each worked out from the rows — nothing here is a
 * stored figure. A number that can't be worked out yet reads "—", never a guess.
 */
function SummaryStrip({ summary }: { summary: ObjectionSummary }) {
  const cells: { label: string; value: string; note: string }[] = [
    {
      label: "OBJECTIONS / CALL",
      value: summary.perCall != null ? String(summary.perCall) : "—",
      note: "analyzed calls",
    },
    {
      label: "HELD CONTROL",
      value: summary.handledRate != null ? percent(summary.handledRate) : "—",
      note: summary.handledOf > 0 ? `of ${summary.handledOf} rated` : "no rated objections",
    },
    {
      label: "MOST COMMON",
      value: summary.top?.label ?? "—",
      note: summary.top ? `${percent(summary.top.share)} of objections` : "—",
    },
  ];
  return (
    <div className="flex items-stretch overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1 px-4 py-3",
            i > 0 && "border-l border-by-border-engraved",
          )}
        >
          <p className="type-mono-micro text-by-text-tertiary">{c.label}</p>
          <p className="type-ui-title truncate text-by-text-primary">{c.value}</p>
          <p className="type-mono-micro text-by-text-secondary">{c.note}</p>
        </div>
      ))}
    </div>
  );
}

/** Static skeleton — "NO SHIMMER THEATRICS" (Y13). */
function ObjectionsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading objections">
      <SkeletonBlock height={64} className="rounded-by-card" />
      <SkeletonBar width={240} height={14} />
      <SkeletonBlock height={260} className="rounded-by-card" />
    </div>
  );
}
