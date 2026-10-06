import { Link } from "@tanstack/react-router";
import { DataBoundary, SkeletonBlock, StateError, SystemState, cn } from "@/components/bylda";
import { useCalls, type Call, type RepSummary } from "@/lib/data";
import { CALL_TYPE_LABEL, shortDate } from "../rep/repFormat";
import { MomentTag, OutcomeTag, RepProfileFrame } from "./repProfile";
import { firstNameOf, minutes, momentText } from "./repProfileFormat";

/**
 * T10 · Rep Profile — Calls
 * Figma 45:1493 (page 1:10) · Lane 4 — Dravin · route /app/team/reps/$repId/calls
 * Hooks: useCalls — see src/lib/data/README.md
 */
export function T10RepProfileCalls() {
  return <RepProfileFrame tab="calls">{(s) => <CallsTable summary={s} />}</RepProfileFrame>;
}

const COLS = {
  call: "w-[230px] shrink-0",
  date: "w-[90px] shrink-0",
  length: "w-[80px] shrink-0",
  outcome: "w-[110px] shrink-0",
  moment: "w-[330px] shrink-0",
  tag: "min-w-[120px] flex-1",
};

function CallsTable({ summary }: { summary: RepSummary }) {
  const calls = useCalls({ repId: summary.rep.id });
  return (
    <DataBoundary
      query={calls}
      loading={<SkeletonBlock height={360} />}
      error={() => (
        <StateError
          eyebrow="REP PROFILE · CALLS"
          body="Bylda couldn’t load these calls. Try again in a moment."
          onRetry={() => void calls.refetch()}
        />
      )}
      empty={
        <SystemState
          eyebrow="REP PROFILE · NO CALLS YET"
          title={`No calls from ${firstNameOf(summary.rep.name)} yet.`}
          body="Calls land here as soon as a connected source syncs them."
          actions={[{ label: "Check connections", variant: "ghost", href: "/app/connections" }]}
        />
      }
    >
      {(rows) => (
        <section
          aria-label="Calls"
          className="flex w-full flex-col overflow-x-auto border border-by-border-engraved bg-by-surface-raised"
        >
          <div className="type-mono-micro flex items-center border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary">
            <span className={COLS.call}>CALL</span>
            <span className={COLS.date}>DATE</span>
            <span className={COLS.length}>LENGTH</span>
            <span className={COLS.outcome}>OUTCOME</span>
            <span className={COLS.moment}>KEY MOMENT</span>
            <span className={COLS.tag} />
          </div>
          {rows.map((c) => (
            <CallRow key={c.id} call={c} />
          ))}
        </section>
      )}
    </DataBoundary>
  );
}

function CallRow({ call: c }: { call: Call }) {
  const subtitle = c.stageAtCall ?? CALL_TYPE_LABEL[c.type];
  return (
    <Link
      to="/app/calls/$callId"
      params={{ callId: c.id }}
      className="flex min-w-[860px] items-center border-b border-by-border-engraved px-4 py-3 transition-colors duration-200 ease-out last:border-b-0 hover:bg-by-surface-hover"
    >
      <span className={cn("flex flex-col", COLS.call)}>
        <span className="type-ui-body-strong truncate text-by-text-primary">{c.account.name}</span>
        <span className="type-mono-micro text-by-text-tertiary">{subtitle}</span>
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.date)}>
        {shortDate(c.startedAt)}
      </span>
      <span className={cn("type-mono-data text-by-text-secondary", COLS.length)}>
        {c.status === "processing" ? "—" : minutes(c.durationSec)}
      </span>
      <span className={COLS.outcome}>
        <OutcomeTag outcome={c.outcome} />
      </span>
      <span className={cn("type-ui-small truncate text-by-text-primary", COLS.moment)}>
        {c.status === "ready" || c.status === "partial" ? momentText(c) : statusText(c)}
      </span>
      <span className={COLS.tag}>
        <MomentTag call={c} />
      </span>
    </Link>
  );
}

const statusText = (c: Call) =>
  c.status === "processing" ? "Processing" : c.status === "failed" ? "Analysis failed" : "";
