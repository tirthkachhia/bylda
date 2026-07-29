/**
 * AiBriefingCard — the Bylda Home focus module.
 * Surfaces the AI-generated business briefing (ai_dashboards payload):
 * headline, north-star metric, and the top quick wins as concrete next
 * actions, with the rest of the briefing expandable in place. Owns its own
 * loading / empty / error / generating states so a failed generation never
 * renders a blank hole.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Target,
  RefreshCw,
  Loader2,
  Zap,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { aiDashboardQuery, generateAiDashboard } from "@/lib/queries";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type QuickWin = {
  title: string;
  impact: string;
  effort: "low" | "medium" | "high";
  description: string;
};

type ToolRec = { tool: string; reason: string; slug: string };

type BriefingPayload = {
  headline?: string;
  summary?: string;
  north_star_metric?: string;
  top_risks?: string[];
  quick_wins?: QuickWin[];
  tool_recommendations?: ToolRec[];
};

const EFFORT_COLOR: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--destructive)",
};

export function AiBriefingCard() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const q = useQuery({
    ...aiDashboardQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const regenerate = async () => {
    if (!currentOrgId || generating) return;
    setGenerating(true);
    try {
      // The edge function backfills business context from onboarding_responses
      // when only organization_id is supplied.
      await generateAiDashboard({ organization_id: currentOrgId });
      await qc.invalidateQueries({ queryKey: ["ai_dashboard", currentOrgId] });
      toast.success("Briefing updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate your briefing");
    } finally {
      setGenerating(false);
    }
  };

  if (!currentOrgId) return null;

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorState
        compact
        variant="generic"
        title="Couldn't load your briefing"
        description="The AI briefing didn't load. Your data is safe — try again."
        onRetry={() => q.refetch()}
      />
    );
  }

  const payload = (q.data?.payload ?? null) as BriefingPayload | null;

  if (!payload) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: "color-mix(in oklab, var(--primary) 30%, transparent)",
          background: "color-mix(in oklab, var(--primary) 6%, transparent)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <div className="font-display text-[14px] font-semibold">
              Your AI briefing isn't ready yet
            </div>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
              Bylda builds a personalized situation report, north-star metric, and quick wins from
              your business context.
            </p>
          </div>
        </div>
        <button
          onClick={regenerate}
          disabled={generating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Generate briefing
            </>
          )}
        </button>
      </div>
    );
  }

  const allWins = payload.quick_wins ?? [];
  const wins = allWins.slice(0, 3);
  const moreWins = allWins.slice(3);
  const risks = payload.top_risks ?? [];
  const tools = payload.tool_recommendations ?? [];
  const topTool = tools[0];
  const moreTools = tools.slice(1);
  const hasMore = moreWins.length > 0 || risks.length > 0 || moreTools.length > 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "color-mix(in oklab, var(--primary) 25%, var(--border))",
        background: "var(--surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--primary)" }}
            >
              <Sparkles className="h-3 w-3" /> Bylda briefing
            </div>
            {payload.headline && (
              <h2 className="mt-1.5 font-display text-[17px] font-semibold leading-snug tracking-tight">
                {payload.headline}
              </h2>
            )}
            {payload.summary && (
              <p
                className="mt-1 text-[12.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {payload.summary}
              </p>
            )}
          </div>
          <button
            onClick={regenerate}
            disabled={generating}
            title="Refresh briefing"
            className="shrink-0 rounded-lg p-2 transition hover:opacity-80 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {payload.north_star_metric && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium"
            style={{
              background: "color-mix(in oklab, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Target className="h-3 w-3" /> North star: {payload.north_star_metric}
          </div>
        )}

        {wins.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {wins.map((w, i) => (
              <div
                key={i}
                className="rounded-xl border p-3"
                style={{
                  borderColor:
                    i === 0
                      ? "color-mix(in oklab, var(--primary) 35%, transparent)"
                      : "var(--border)",
                  background:
                    i === 0
                      ? "color-mix(in oklab, var(--primary) 5%, transparent)"
                      : "var(--surface-2)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: i === 0 ? "var(--primary)" : "var(--muted-foreground)" }}
                  >
                    {i === 0 ? "Do this first" : `Quick win ${i + 1}`}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase"
                    style={{
                      color: EFFORT_COLOR[w.effort] ?? "var(--muted-foreground)",
                      background: "color-mix(in oklab, currentColor 10%, transparent)",
                    }}
                  >
                    {w.effort} effort
                  </span>
                </div>
                <div className="mt-1.5 text-[12.5px] font-semibold leading-snug">{w.title}</div>
                {w.impact && (
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {w.impact}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {topTool?.slug && (
            <Link
              to="/app/launchpad/$tool"
              params={{ tool: topTool.slug }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
            >
              <Zap className="h-3.5 w-3.5" /> {topTool.tool || "Run recommended tool"}
            </Link>
          )}
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium transition hover:opacity-80"
              style={{ color: "var(--primary)" }}
            >
              {expanded ? "Show less" : "Full briefing"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>

        {expanded && hasMore && (
          <div
            className="mt-4 space-y-4 border-t pt-4"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {risks.length > 0 && (
              <div>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--destructive)" }}
                >
                  Top risks
                </div>
                <ul className="mt-2 space-y-1.5">
                  {risks.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[12.5px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <AlertTriangle
                        className="mt-0.5 h-3 w-3 shrink-0"
                        style={{ color: "var(--destructive)" }}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {moreWins.length > 0 && (
              <div>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  More quick wins
                </div>
                <ul className="mt-2 space-y-2">
                  {moreWins.map((w, i) => (
                    <li key={i} className="text-[12.5px]">
                      <span className="font-semibold">{w.title}</span>
                      {w.impact && (
                        <span style={{ color: "var(--muted-foreground)" }}> — {w.impact}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {moreTools.length > 0 && (
              <div>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Recommended tools
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {moreTools.map(
                    (t, i) =>
                      t.slug && (
                        <Link
                          key={i}
                          to="/app/launchpad/$tool"
                          params={{ tool: t.slug }}
                          title={t.reason}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition hover:opacity-80"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          <Zap className="h-3 w-3" style={{ color: "var(--primary)" }} />
                          {t.tool}
                        </Link>
                      ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
