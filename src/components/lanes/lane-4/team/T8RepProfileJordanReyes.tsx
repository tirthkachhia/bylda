import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  SkeletonBlock,
  StateError,
  SystemState,
  Tag,
  cn,
  type TagTone,
} from "@/components/bylda";
import {
  REP_INSIGHT_MIN_CALLS,
  useCalls,
  useCoachingFoci,
  useRepScores,
  useRepSummary,
  type BehaviorScore,
  type Call,
  type CoachingFocus,
  type RepSummary,
} from "@/lib/data";
import { LocalSparkline } from "../rep/LocalSparkline";
import { OUTCOME_LABEL, directionTone, formatMedian, formatScore } from "../rep/repFormat";
import {
  AssignButton,
  NeedsFromYou,
  OutcomeTag,
  PanelLabel,
  ProfileSkeleton,
  RepMeta,
} from "./repProfile";
import { firstNameOf, focusDates, focusTag, minutes, useRepIdParam } from "./repProfileFormat";

/**
 * T8 · Rep Profile — Jordan Reyes (manager view)
 * Figma 12:271 (page 1:10) · Lane 4 — Dravin · route /app/team/reps/$repId
 * Hooks: useRepSummary (+ useInsights, useRepScores, useCoachingFoci, useCalls)
 *
 * The one-page manager read of a rep: the one thing to coach, the behavior profile on
 * fixed y-ranges, coaching history, and outcomes in the context panel. The team median
 * is an anonymous aggregate the data layer nulls under 8 reps — then the column is gone.
 */
export function T8RepProfileJordanReyes() {
  const repId = useRepIdParam();
  const summary = useRepSummary(repId);
  return (
    <div className="flex w-full flex-col gap-5 px-9 py-7 max-[1024px]:px-6">
      <DataBoundary
        query={summary}
        loading={<ProfileSkeleton />}
        error={() => (
          <StateError
            eyebrow="TEAM · REP PROFILE"
            body="Bylda couldn’t load this rep. Try again in a moment."
            onRetry={() => void summary.refetch()}
          />
        )}
        empty={
          <SystemState
            eyebrow="TEAM · REP PROFILE"
            title="This rep isn’t in your workspace."
            body="They may have left the team, or the link is wrong."
            actions={[{ label: "Back to Team", variant: "ghost", href: "/app/team" }]}
          />
        }
      >
        {(s) => (s ? <Profile summary={s} /> : null)}
      </DataBoundary>
    </div>
  );
}

function Profile({ summary }: { summary: RepSummary }) {
  const first = firstNameOf(summary.rep.name);
  return (
    <>
      <nav aria-label="Breadcrumb" className="type-mono-micro flex gap-2 text-by-text-tertiary">
        <Link to="/app/team" className="hover:text-by-text-primary">
          TEAM
        </Link>
        <span aria-hidden>/</span>
        <span className="text-by-text-primary">{summary.rep.name.toUpperCase()}</span>
      </nav>

      <header className="flex items-center gap-4">
        <Avatar name={summary.rep.name} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="type-editorial-h1 truncate text-by-text-primary">{summary.rep.name}</h1>
          <RepMeta summary={summary} window="analyzed (30d)" className="type-mono-data" />
        </div>
        {/* GAP: 1:1 notes have no object or route (LANE_REQUESTS #32). */}
        <Button variant="secondary" disabled title="1:1 notes aren’t available yet">
          1:1 notes
        </Button>
        <AssignButton repId={summary.rep.id} />
      </header>

      <NeedsFromYou repId={summary.rep.id} firstName={first} variant="wide" />
      <BehaviorProfile repId={summary.rep.id} firstName={first} />
      <CoachingHistory repId={summary.rep.id} />

      <ContextPanel>
        <RepContext repId={summary.rep.id} />
      </ContextPanel>
    </>
  );
}

// ── behavior profile ──────────────────────────────────────────────────────────

const COLS = {
  behavior: "w-[180px] shrink-0",
  rep: "w-[110px] shrink-0",
  team: "w-[90px] shrink-0",
  trend: "w-[110px] shrink-0",
  tag: "min-w-[90px] flex-1",
};

/** Strength / Watch / Leak — colour is the behavior's direction, nothing else. */
function profileTag(s: BehaviorScore): { tone: TagTone; label: string } {
  if (s.direction === "improving") return { tone: "improve", label: "Strength" };
  if (s.direction === "regressing") return { tone: "regress", label: "Leak" };
  return { tone: "neutral", label: "Watch" };
}

function BehaviorProfile({ repId, firstName }: { repId: string; firstName: string }) {
  const scores = useRepScores(repId);
  return (
    <section
      aria-label="Behavior profile"
      className="flex w-full flex-col overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <div className="flex items-center gap-3 border-b border-by-border-engraved px-[18px] py-3.5">
        <p className="type-ui-label flex-1 text-by-text-primary">BEHAVIOR PROFILE · 30 DAYS</p>
        <p className="type-mono-micro text-by-text-tertiary">
          {scores.data?.some((s) => s.teamMedian !== null)
            ? "vs team median · vs own baseline"
            : "vs own baseline"}
        </p>
      </div>
      <DataBoundary
        query={scores}
        loading={<SkeletonBlock height={240} className="m-4" />}
        error={() => (
          <StateError body="Couldn’t load behaviors." onRetry={() => void scores.refetch()} />
        )}
        empty={
          <SystemState
            surface="bare"
            eyebrow="REP · NOT ENOUGH CALLS YET"
            tag={{ tone: "attention", label: "Low evidence" }}
            title="No behavior scores yet."
            body={`They appear once ${REP_INSIGHT_MIN_CALLS} of this rep’s calls are analyzed.`}
            className="p-5"
          />
        }
      >
        {(rows) => {
          // Same team for every row — the median shows for all of them or none (§13.6).
          const hasMedian = rows.every((s) => s.teamMedian !== null);
          return (
            <div className="overflow-x-auto">
              <div className="type-mono-micro flex min-w-[620px] items-center border-b border-by-border-engraved bg-by-surface-inset px-[18px] py-[9px] text-by-text-tertiary">
                <span className={COLS.behavior}>BEHAVIOR</span>
                <span className={COLS.rep}>{firstName.toUpperCase()}</span>
                {hasMedian ? <span className={COLS.team}>TEAM</span> : null}
                <span
                  className={COLS.trend}
                >{`${rows[0]?.sparkline.points.length ?? 0} WEEKS`}</span>
                <span className={COLS.tag} />
              </div>
              {rows.map((s) => {
                const tag = profileTag(s);
                return (
                  <div
                    key={s.behaviorKey}
                    className="flex min-w-[620px] items-center border-b border-by-border-engraved px-[18px] py-2 last:border-b-0"
                  >
                    <span className={cn("type-ui-body text-by-text-primary", COLS.behavior)}>
                      {s.name}
                    </span>
                    <span
                      className={cn(
                        "type-mono-data",
                        s.direction === "regressing"
                          ? "text-by-signal-regress"
                          : "text-by-text-primary",
                        COLS.rep,
                      )}
                      title={`n = ${s.sampleSize} · confidence ${s.confidence}`}
                    >
                      {formatScore(s.value, s.unit)}
                    </span>
                    {hasMedian && s.teamMedian !== null ? (
                      <span className={cn("type-mono-data text-by-text-secondary", COLS.team)}>
                        {formatMedian(s.teamMedian, s.unit)}
                      </span>
                    ) : null}
                    <span className={COLS.trend}>
                      <LocalSparkline
                        sparkline={s.sparkline}
                        tone={directionTone(s.direction)}
                        className="h-4 w-[80px]"
                      />
                    </span>
                    <span className={COLS.tag}>
                      <Tag tone={tag.tone}>{tag.label}</Tag>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }}
      </DataBoundary>
    </section>
  );
}

// ── coaching history ──────────────────────────────────────────────────────────

/** One line on where the focus stands — from its own numbers only. */
function focusLine(f: CoachingFocus): string {
  if (f.result) {
    const verdict =
      f.result.verdict === "held"
        ? "held"
        : f.result.verdict === "reverted"
          ? "reverted"
          : "not yet";
    return `${f.metric}: ${f.result.baseline} → ${f.result.value}, ${verdict} (n = ${f.result.sampleSize}).`;
  }
  const judge = f.judgeAfter.calls ? ` Judged after ${f.judgeAfter.calls} calls.` : "";
  return `Baseline ${f.baseline} → target ${f.target}.${judge}`;
}

/** Figma T8 names in-flight foci "Active" and measured ones "Completed"; colour from the result. */
function historyTag(f: CoachingFocus): { tone: TagTone; label: string } {
  if (!f.result) return { tone: "info", label: "Active" };
  return { tone: focusTag(f).tone, label: "Completed" };
}

function CoachingHistory({ repId }: { repId: string }) {
  const foci = useCoachingFoci({ repId });
  return (
    <section
      aria-label="Coaching history"
      className="flex flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4"
    >
      <p className="type-ui-label text-by-text-primary">COACHING HISTORY</p>
      <DataBoundary
        query={foci}
        loading={<SkeletonBlock height={120} />}
        error={() => (
          <StateError body="Couldn’t load coaching." onRetry={() => void foci.refetch()} />
        )}
        empty={
          <p className="type-ui-small py-2 text-by-text-secondary">
            No coaching yet. Assign one focus and Bylda measures whether it changes.
          </p>
        }
      >
        {(rows) => (
          <ul className="flex flex-col">
            {[...rows]
              .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
              .map((f) => {
                const tag = historyTag(f);
                return (
                  <li key={f.id}>
                    <Link
                      to="/app/coaching/$focusId"
                      params={{ focusId: f.id }}
                      className="flex items-start gap-4 border-b border-by-border-engraved py-3 transition-colors duration-200 ease-out hover:bg-by-surface-hover"
                    >
                      <span className="type-mono-data w-[120px] shrink-0 text-by-text-secondary">
                        {focusDates(f)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="type-ui-body-strong text-by-text-primary">
                          {f.behaviorName}
                        </span>
                        <span className="type-ui-small text-by-text-secondary">{focusLine(f)}</span>
                      </span>
                      <Tag tone={tag.tone}>{tag.label}</Tag>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </DataBoundary>
    </section>
  );
}

// ── context panel ─────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function RepContext({ repId }: { repId: string }) {
  const calls = useCalls({ repId });
  return (
    <DataBoundary
      query={calls}
      loading={<SkeletonBlock height={360} />}
      error={() => (
        <StateError body="Couldn’t load this rep’s calls." onRetry={() => void calls.refetch()} />
      )}
      empty={
        <div className="flex flex-col gap-3">
          <PanelLabel>OUTCOMES · 30D</PanelLabel>
          <p className="type-ui-small text-by-text-secondary">No calls in the last 30 days.</p>
        </div>
      }
    >
      {(rows) => {
        const newest = rows.reduce((m, c) => Math.max(m, Date.parse(c.startedAt)), 0);
        const recent = rows.filter((c) => newest - Date.parse(c.startedAt) <= THIRTY_DAYS_MS);
        return (
          <div className="flex flex-col gap-6">
            <Outcomes calls={recent} />
            {/* GAP: per-rep objection stats (OBJECTIONS · 30D) — LANE_REQUESTS #32. */}
            <CallLength calls={recent.filter((c) => c.status !== "processing")} />
            <RecentCalls calls={rows.slice(0, 4)} />
          </div>
        );
      }}
    </DataBoundary>
  );
}

function Outcomes({ calls }: { calls: Call[] }) {
  const count = (o: Call["outcome"]) => calls.filter((c) => c.outcome === o).length;
  const tiles: [string, number][] = [
    ["WON", count("won")],
    ["LOST", count("lost")],
    ["ADVANCED", count("advanced")],
    ["STALLED", count("no_decision")],
  ];
  return (
    <div className="flex flex-col gap-3">
      <PanelLabel>OUTCOMES · 30D</PanelLabel>
      <div className="grid grid-cols-4 rounded-by-tile border border-by-border-engraved bg-by-surface-inset px-2.5 py-2.5">
        {tiles.map(([label, n]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="type-mono-micro text-by-text-tertiary">{label}</span>
            <span className="type-ui-title text-by-text-primary">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function CallLength({ calls }: { calls: Call[] }) {
  if (!calls.length) return null;
  const byLength = [...calls].sort((a, b) => b.durationSec - a.durationSec);
  const describe = (c: Call) =>
    [
      c.account.name,
      minutes(c.durationSec).replace("m", " min"),
      c.outcome ? OUTCOME_LABEL[c.outcome].toLowerCase() : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const rows: [string, string][] = [
    ["Median", minutes(median(calls.map((c) => c.durationSec))).replace("m", " min")],
    ["Longest", describe(byLength[0])],
  ];
  if (byLength.length > 1) rows.push(["Shortest", describe(byLength[byLength.length - 1])]);
  return (
    <div className="flex flex-col gap-1">
      <PanelLabel>CALL LENGTH</PanelLabel>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start gap-3 border-b border-by-border-engraved py-2">
          <span className="type-mono-micro w-[64px] shrink-0 pt-0.5 text-by-text-tertiary">
            {label}
          </span>
          <span className="type-ui-small flex-1 text-by-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

function RecentCalls({ calls }: { calls: Call[] }) {
  return (
    <div className="flex flex-col gap-1">
      <PanelLabel>RECENT CALLS</PanelLabel>
      {calls.map((c) => (
        <Link
          key={c.id}
          to="/app/calls/$callId"
          params={{ callId: c.id }}
          className="flex items-center gap-2 border-b border-by-border-engraved py-2 transition-colors duration-200 ease-out hover:bg-by-surface-hover"
        >
          <span className="type-ui-small min-w-0 flex-1 truncate text-by-text-primary">
            {c.account.name}
          </span>
          <span className="type-mono-micro text-by-text-tertiary">
            {`${WEEKDAY.format(new Date(c.startedAt))} · ${minutes(c.durationSec)}`}
          </span>
          <OutcomeTag outcome={c.outcome} />
        </Link>
      ))}
    </div>
  );
}
