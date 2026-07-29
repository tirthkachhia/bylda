/**
 * WeeklyReviewCard — renders the latest Weekly Operating Review (wins, stalls,
 * next week's focus) and lets the user generate/refresh it on demand. The
 * cron generates these Monday mornings; this card is why they come back.
 */

import { useState } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { CalendarCheck2, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { toast } from "sonner";

type Review = {
  headline?: string;
  momentum?: "accelerating" | "steady" | "stalling";
  wins?: string[];
  stalls?: string[];
  focus_next_week?: Array<{ title: string; reason: string }>;
};

const weeklyReviewQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["weekly_review", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reviews" as never)
        .select("*")
        .eq("organization_id", orgId)
        .order("week_start", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as unknown as Array<{ payload: Review; week_start: string }>)?.[0] ?? null;
    },
  });

const MOMENTUM = {
  accelerating: { icon: TrendingUp, color: "var(--success)", label: "Accelerating" },
  steady: { icon: Minus, color: "var(--warning)", label: "Steady" },
  stalling: { icon: TrendingDown, color: "var(--destructive)", label: "Stalling" },
} as const;

export function WeeklyReviewCard() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const q = useQuery({ ...weeklyReviewQuery(currentOrgId ?? ""), enabled: !!currentOrgId });

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await invokeEdge("weekly-review", {}, { timeoutMs: 90_000 });
      await qc.invalidateQueries({ queryKey: ["weekly_review", currentOrgId] });
      toast.success("Weekly review ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the review");
    } finally {
      setGenerating(false);
    }
  };

  if (!currentOrgId || q.isLoading) return null;

  const review = q.data?.payload ?? null;
  const momentum = review?.momentum ? MOMENTUM[review.momentum] : null;

  if (!review) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: "color-mix(in oklab, var(--primary) 25%, var(--border))",
          background: "color-mix(in oklab, var(--primary) 4%, transparent)",
        }}
      >
        <div className="flex items-start gap-3">
          <CalendarCheck2 className="mt-0.5 h-4 w-4" style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-[13.5px] font-semibold">Your Weekly Operating Review</div>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Wins, stalls, and next week's focus — built from your actual activity, every Monday.
            </p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarCheck2 className="h-3.5 w-3.5" />
          )}
          Generate this week's review
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: "color-mix(in oklab, var(--primary) 25%, var(--border))",
        background: "var(--surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--primary)" }}
          >
            <CalendarCheck2 className="h-3 w-3" /> Weekly operating review
            <span className="font-normal normal-case" style={{ color: "var(--muted-foreground)" }}>
              · week of {q.data?.week_start}
            </span>
          </div>
          {review.headline && (
            <h2 className="mt-1.5 font-display text-[16px] font-semibold leading-snug">
              {review.headline}
            </h2>
          )}
          {momentum && (
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                color: momentum.color,
                background: "color-mix(in oklab, currentColor 10%, transparent)",
              }}
            >
              <momentum.icon className="h-3 w-3" /> {momentum.label}
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          title="Refresh review"
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

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ReviewList title="Wins" tone="var(--success)" items={review.wins ?? []} />
        <ReviewList title="Stalls" tone="var(--destructive)" items={review.stalls ?? []} />
        <div>
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--primary)" }}
          >
            Focus next week
          </div>
          <div className="mt-2 space-y-2">
            {(review.focus_next_week ?? []).slice(0, 3).map((f, i) => (
              <div
                key={i}
                className="rounded-lg border p-2.5"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <div className="text-[12px] font-semibold leading-snug">{f.title}</div>
                <p
                  className="mt-0.5 text-[11px] leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {f.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewList({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div>
      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: tone }}
      >
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 4).map((w, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: tone }} />
            <span style={{ color: "var(--foreground)" }}>{w}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing logged this week.
          </li>
        )}
      </ul>
    </div>
  );
}
