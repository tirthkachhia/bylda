import { useNavigate } from "@tanstack/react-router";
import { Button, ConfidenceMeter, cn } from "@/components/bylda";
import type { Insight } from "@/lib/data";

const TONE: Record<Insight["tone"], string> = {
  info: "text-by-signal-info",
  regress: "text-by-signal-regress",
  attention: "text-by-signal-attention",
  improve: "text-by-signal-improve",
  neutral: "text-by-text-secondary",
};

/**
 * Important-today card (Figma 27:415 · 27:435 · 27:449): eyebrow → insight → why → confidence +
 * n → action. The first card runs the full width and carries the "IMPORTANT TODAY" prefix.
 * Low confidence = observation only: no action renders (CLAUDE.md §4). Hero card ⇒ the one
 * soft shadow (§13.3).
 */
export function ImportantCard({ insight, hero }: { insight: Insight; hero?: boolean }) {
  const navigate = useNavigate();
  const category = (insight.tag ?? insight.kind).toUpperCase();
  const action = insight.confidence === "low" ? null : insight.action;

  const go = () => {
    if (!action) return;
    switch (action.type) {
      case "review_calls":
        if (action.callIds[0])
          void navigate({ to: "/app/calls/$callId", params: { callId: action.callIds[0] } });
        return;
      case "open_behavior":
        void navigate({
          to: "/app/intelligence/behaviors/$behaviorKey",
          params: { behaviorKey: action.behaviorKey },
        });
        return;
      case "assign_coaching":
        void navigate({
          to: "/app/coaching/assign",
          search: { repId: action.repId, behaviorKey: action.behaviorKey } as never,
        });
        return;
      case "open_report":
        void navigate({ to: "/app/reports" });
        return;
    }
  };

  return (
    <article
      className={cn(
        "animate-by-resolve flex min-w-0 flex-col items-start gap-2.5 rounded-by-card border border-by-border-engraved bg-by-surface-raised px-[18px] py-4",
        hero ? "w-full shadow-by-float" : "flex-1",
      )}
    >
      <p className={cn("type-mono-micro flex items-center gap-2", "text-by-text-secondary")}>
        <svg
          width="10"
          height="9"
          viewBox="0 0 10 9"
          aria-hidden
          className={cn("shrink-0", TONE[insight.tone])}
        >
          <path d="M5 0.5 9.3 8.5H0.7Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {hero ? `IMPORTANT TODAY · ${category}` : category}
      </p>
      <h2 className="type-editorial-insight text-by-text-primary">{insight.headline}</h2>
      {insight.body ? <p className="type-ui-small text-by-text-secondary">{insight.body}</p> : null}
      <ConfidenceMeter
        level={insight.confidence}
        sampleSize={insight.sampleSize}
        sampleLabel={insight.sampleLabel ?? undefined}
      />
      {insight.confidence === "low" ? (
        <p className="type-mono-micro text-by-text-tertiary">
          OBSERVATION ONLY — LOW CONFIDENCE, NO ACTION RECOMMENDED
        </p>
      ) : action ? (
        <div className="flex items-start gap-2">
          <Button variant="primary" onClick={go}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
