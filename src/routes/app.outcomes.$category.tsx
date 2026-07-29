// Pick your next goal — the goal-first page for each category.
// One recommended goal up top (Bylda picked it), everything else in a quiet
// list: done, open, or locked. Plain words, sharp corners, zero guessing.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, ListChecks, Lock, Star, Target } from "lucide-react";
import {
  OUTCOME_CATEGORIES,
  OUTCOME_ENGINES,
  getOutcomesByCategory,
  isOutcomeDone,
  isOutcomeLocked,
  isValidCategory,
  type OutcomeEngine,
} from "@/lib/outcome-engines";
import { useBusinessGraph } from "@/hooks/use-business-graph";

export const Route = createFileRoute("/app/outcomes/$category")({
  component: GoalsPage,
});

function GoalsPage() {
  const { category } = Route.useParams();
  const navigate = useNavigate();
  const graph = useBusinessGraph();

  if (!isValidCategory(category)) {
    void navigate({ to: "/app/mission-control" });
    return null;
  }

  const meta = OUTCOME_CATEGORIES[category];
  const outcomes = getOutcomesByCategory(category);
  const done = graph.signals.succeededToolKeys;

  const recommended =
    outcomes.find((o) => !isOutcomeDone(o, done) && !isOutcomeLocked(o, done)) ?? null;
  const rest = outcomes.filter((o) => o.id !== recommended?.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      {/* ── Header ── */}
      <div>
        <div className="mb-3 text-[12.5px] font-semibold" style={{ color: "var(--text-faint)" }}>
          <Link to="/app/mission-control" style={{ color: "var(--text-faint)" }}>
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span style={{ color: "var(--muted-foreground)" }}>{meta.label}</span>
        </div>
        <h1
          className="text-[24px] font-extrabold leading-tight"
          style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
        >
          Pick your next goal
        </h1>
        <p
          className="mt-1.5 text-[14px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {meta.tagline}. Pick one goal — Bylda walks you through it, one small step at a time. You
          never have to guess what to do next.
        </p>
      </div>

      {/* ── Recommended goal ── */}
      {recommended && (
        <div
          className="overflow-hidden rounded-[6px] border"
          style={{
            borderColor: "var(--primary-border)",
            borderLeft: "4px solid var(--primary)",
            background: "var(--surface)",
            boxShadow:
              "0 4px 8px var(--primary-glow), 0 12px 32px color-mix(in oklab, var(--primary) 8%, transparent)",
          }}
        >
          <div
            className="flex items-center gap-2 px-5 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em]"
            style={{
              color: "var(--primary)",
              background: "var(--primary-soft)",
              borderBottom: "1px solid var(--primary-border)",
            }}
          >
            <Star className="h-3.5 w-3.5" />
            Start here — the best next goal for you
          </div>

          <div className="px-5 pb-5 pt-4">
            <h2
              className="text-[19px] font-extrabold"
              style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
            >
              {recommended.name}
            </h2>
            <p
              className="mt-1 text-[13.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              <b style={{ color: "var(--foreground)", fontWeight: 650 }}>What you get: </b>
              {recommended.outcome}
            </p>
            <div
              className="mt-2.5 flex gap-4 text-[12px] font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                about {recommended.estimatedMinutes} minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                {recommended.steps.length} step{recommended.steps.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Steps table */}
            <div className="mt-4">
              <div
                className="mb-1.5 text-[12px] font-bold"
                style={{ color: "var(--muted-foreground)" }}
              >
                The {recommended.steps.length} step{recommended.steps.length === 1 ? "" : "s"} —
                Bylda guides you through each one:
              </div>
              <div
                className="overflow-hidden rounded-[4px] border"
                style={{ borderColor: "var(--border)" }}
              >
                {recommended.steps.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-stretch"
                    style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
                  >
                    <div
                      className="flex w-10 shrink-0 items-center justify-center text-[13px] font-extrabold"
                      style={{
                        color: "var(--primary)",
                        background: "var(--primary-soft)",
                        borderRight: "1px solid var(--primary-border)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="px-3.5 py-2.5 text-[13px] leading-relaxed">
                      <span className="font-bold" style={{ color: "var(--foreground)" }}>
                        {s.title}
                      </span>
                      <span
                        className="ml-2 text-[11.5px] font-semibold"
                        style={{ color: "var(--text-faint)" }}
                      >
                        · {s.estimatedMinutes} min
                      </span>
                      <div style={{ color: "var(--muted-foreground)" }}>{s.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to={recommended.steps[0].to}
              className="mt-4 inline-flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90"
              style={{ background: "var(--primary)", boxShadow: "0 2px 6px var(--primary-glow)" }}
            >
              Start this goal
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── The rest, quiet ── */}
      {rest.length > 0 && (
        <div>
          <div
            className="mb-2.5 px-0.5 text-[12px] font-bold uppercase tracking-[0.07em]"
            style={{ color: "var(--text-faint)" }}
          >
            More goals
          </div>
          <div
            className="overflow-hidden rounded-[6px] border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {rest.map((o, i) => (
              <GoalRow key={o.id} outcome={o} succeededToolKeys={done} first={i === 0} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pb-4">
        <Link
          to="/app/mission-control"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
          style={{ color: "var(--primary)" }}
        >
          Back to Home <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function GoalRow({
  outcome,
  succeededToolKeys,
  first,
}: {
  outcome: OutcomeEngine;
  succeededToolKeys: string[];
  first: boolean;
}) {
  const done = isOutcomeDone(outcome, succeededToolKeys);
  const locked = !done && isOutcomeLocked(outcome, succeededToolKeys);
  const prerequisite = locked
    ? OUTCOME_ENGINES.find((e) => e.leadsTo.includes(outcome.id))
    : undefined;

  return (
    <div
      className="flex items-center gap-4 px-4.5 py-4"
      style={{ padding: "15px 18px", borderTop: first ? "none" : "1px solid var(--border-subtle)" }}
    >
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[4px] border"
        style={
          done
            ? {
                background: "color-mix(in oklab, var(--success) 9%, var(--surface))",
                borderColor: "color-mix(in oklab, var(--success) 30%, transparent)",
              }
            : locked
              ? {
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  borderStyle: "dashed",
                }
              : { background: "var(--surface-2)", borderColor: "var(--border)" }
        }
      >
        {done ? (
          <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
        ) : locked ? (
          <Lock className="h-4 w-4" style={{ color: "var(--text-faint)" }} />
        ) : (
          <Target className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
        )}
      </span>

      <div className="min-w-0">
        <div
          className="text-[14px] font-bold"
          style={{ color: locked ? "var(--muted-foreground)" : "var(--foreground)" }}
        >
          {outcome.name}
        </div>
        <div
          className="mt-0.5 text-[12.5px] leading-snug"
          style={{ color: "var(--muted-foreground)" }}
        >
          {locked && prerequisite ? `Unlocks after "${prerequisite.name}".` : outcome.impact}
        </div>
      </div>

      <div className="ml-auto shrink-0">
        {done ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[11.5px] font-bold"
            style={{
              color: "var(--success)",
              background: "color-mix(in oklab, var(--success) 9%, var(--surface))",
              borderColor: "color-mix(in oklab, var(--success) 30%, transparent)",
            }}
          >
            <Check className="h-3 w-3" />
            Done
          </span>
        ) : locked ? (
          <span
            className="inline-flex items-center rounded-[3px] border border-dashed px-2.5 py-1 text-[11.5px] font-bold"
            style={{
              color: "var(--text-faint)",
              background: "var(--surface-2)",
              borderColor: "var(--border)",
            }}
          >
            Locked for now
          </span>
        ) : (
          <Link
            to={outcome.steps[0].to}
            className="inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[11.5px] font-bold"
            style={{
              color: "var(--muted-foreground)",
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <Clock className="h-3 w-3" />
            {outcome.estimatedMinutes} min
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
