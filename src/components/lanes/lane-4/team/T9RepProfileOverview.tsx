import { Link } from "@tanstack/react-router";
import { DataBoundary, Icon, SkeletonBlock, StateError, cn } from "@/components/bylda";
import { useCalls, type BehaviorScore, type Call, type RepSummary } from "@/lib/data";
import { LocalSparkline } from "../rep/LocalSparkline";
import { directionTone, formatMedian, formatScore, shortDate, useNow } from "../rep/repFormat";
import { ChartGrid, MomentTag, NeedsFromYou, RepProfileFrame } from "./repProfile";
import { firstNameOf } from "./repProfileFormat";

/**
 * T9 · Rep Profile — Overview
 * Figma 45:1147 (page 1:10) · Lane 4 — Dravin · route /app/team/reps/$repId/overview
 * Hooks: useRepSummary (+ useInsights, useCalls) — see src/lib/data/README.md
 *
 * Manager view. Every number comes from the data layer; sparklines plot on each
 * behavior's fixed y-range (§4). Team median only when the data layer sends it (§13.6).
 */
export function T9RepProfileOverview() {
  return <RepProfileFrame tab="overview">{(s) => <Overview summary={s} />}</RepProfileFrame>;
}

function Overview({ summary }: { summary: RepSummary }) {
  const first = firstNameOf(summary.rep.name);
  return (
    <>
      <div className="flex items-start gap-[18px] max-[1200px]:flex-col">
        <PerformanceTrend summary={summary} />
        <div className="w-[330px] shrink-0 max-[1200px]:w-full">
          <NeedsFromYou repId={summary.rep.id} firstName={first} variant="compact" />
        </div>
      </div>
      <KeyBehaviors summary={summary} />
      <RecentCalls repId={summary.rep.id} />
    </>
  );
}

/** Relative movement across the series' own fixed range — 0 when flat. */
const moved = (s: BehaviorScore) => {
  const p = s.sparkline.points;
  return p.length > 1 ? (p[p.length - 1] - p[0]) / (s.sparkline.yMax - s.sparkline.yMin || 1) : 0;
};

/**
 * GAP: Figma plots a composite "methodology score". No composite exists in the data
 * layer (LANE_REQUESTS #32), so the card plots the behavior that moved most — a real
 * series on its own fixed y-range, named, with its confidence and n.
 */
function PerformanceTrend({ summary }: { summary: RepSummary }) {
  const scores = [...summary.strengths, ...summary.leaks];
  const lead = scores
    .filter((s) => s.sparkline.points.length > 1)
    .sort((a, b) => Math.abs(moved(b)) - Math.abs(moved(a)))[0];
  const p = lead?.sparkline.points ?? [];
  const pct =
    p.length > 1 && p[0] !== 0 ? Math.round(((p[p.length - 1] - p[0]) / p[0]) * 100) : null;
  const tone = lead ? directionTone(lead.direction) : "neutral";
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
      <div className="flex items-start gap-3">
        <p className="type-ui-title flex-1 text-by-text-primary">Performance trend</p>
        {lead && pct !== null ? (
          <p
            className={cn(
              "type-ui-body-strong flex items-center gap-1",
              tone === "improve" && "text-by-signal-improve",
              tone === "regress" && "text-by-signal-regress",
              tone === "neutral" && "text-by-text-secondary",
            )}
          >
            <Icon name="trend" size={14} className={cn(pct < 0 && "-scale-y-100")} />
            {`${Math.abs(pct)}% ${lead.name.toLowerCase()}`}
          </p>
        ) : null}
      </div>
      {lead ? (
        <>
          <p className="type-ui-small text-by-text-tertiary">
            {`${lead.name} · last ${p.length} weeks · n = ${lead.sampleSize}`}
          </p>
          <ChartGrid>
            <LocalSparkline
              sparkline={lead.sparkline}
              tone="neutral"
              className="h-full w-full text-by-text-primary"
            />
          </ChartGrid>
        </>
      ) : (
        <p className="type-ui-small text-by-text-secondary">
          No trend yet — it appears once enough calls are analyzed.
        </p>
      )}
    </section>
  );
}

function KeyBehaviors({ summary }: { summary: RepSummary }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
      <p className="type-ui-title text-by-text-primary">Key behaviors</p>
      <div className="flex items-start gap-6 max-[900px]:flex-col">
        <BehaviorList title="Strengths" tone="improve" scores={summary.strengths} />
        <BehaviorList title="Focus areas" tone="regress" scores={summary.leaks} />
      </div>
    </section>
  );
}

function BehaviorList({
  title,
  tone,
  scores,
}: {
  title: string;
  tone: "improve" | "regress";
  scores: BehaviorScore[];
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p
        className={cn(
          "type-ui-body-strong",
          tone === "improve" ? "text-by-signal-improve" : "text-by-signal-regress",
        )}
      >
        {title}
      </p>
      {scores.length ? (
        scores.map((s) => (
          <p
            key={s.behaviorKey}
            className="type-ui-small flex items-center gap-2 text-by-text-primary"
            title={`n = ${s.sampleSize} · confidence ${s.confidence}`}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-by-pill",
                tone === "improve" ? "bg-by-signal-improve" : "bg-by-signal-regress",
              )}
            />
            {`${s.name} — ${formatScore(s.value, s.unit)}`}
            {s.teamMedian !== null ? ` (team ${formatMedian(s.teamMedian, s.unit)})` : ""}
          </p>
        ))
      ) : (
        <p className="type-ui-small text-by-text-secondary">None with enough evidence yet.</p>
      )}
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

/** "Today" · "Yesterday" · "Fri" within a week · "Sep 3" before. Viewer clock only (SSR-safe). */
function relativeDay(iso: string, now: Date | null): string {
  if (!now) return shortDate(iso);
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(now) - day(new Date(iso))) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAY.format(new Date(iso));
  return shortDate(iso);
}

function RecentCalls({ repId }: { repId: string }) {
  const calls = useCalls({ repId, limit: 4 });
  const now = useNow();
  return (
    <section className="flex flex-col gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4">
      <p className="type-ui-title text-by-text-primary">Recent calls</p>
      <DataBoundary
        query={calls}
        loading={<SkeletonBlock height={160} />}
        error={() => (
          <StateError body="Couldn’t load recent calls." onRetry={() => void calls.refetch()} />
        )}
        empty={
          <p className="type-ui-small text-by-text-secondary">No calls in the last 30 days.</p>
        }
      >
        {(rows) => (
          <ul className="flex flex-col">
            {rows.map((c: Call) => (
              <li key={c.id}>
                <Link
                  to="/app/calls/$callId"
                  params={{ callId: c.id }}
                  className="flex items-center gap-2.5 border-b border-by-border-engraved py-2 transition-colors duration-200 ease-out hover:bg-by-surface-hover"
                >
                  <Icon name="play" size={12} className="fill-current text-by-text-primary" />
                  <span className="type-ui-body-strong min-w-0 flex-1 truncate text-by-text-primary">
                    {c.account.name}
                  </span>
                  <span className="type-ui-small text-by-text-tertiary">
                    {relativeDay(c.startedAt, now)}
                  </span>
                  <MomentTag call={c} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DataBoundary>
    </section>
  );
}
