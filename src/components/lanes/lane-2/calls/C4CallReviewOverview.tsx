import { ConfidenceMeter, Icon, cn } from "@/components/bylda";
import { ReviewScreen, Player, ReviewSummary, ReviewEmpty } from "./ReviewLayout";
import { timeLabel } from "./reviewModel";

/** C4 · Overview · design-ref/C4 · existing CallReview hook only. */
export function C4CallReviewOverview() {
  return (
    <ReviewScreen tab="overview">
      {(props) => (
        <>
          <Player {...props} />
          <div className="grid items-start gap-[18px] min-[1200px]:grid-cols-[minmax(0,1fr)_360px]">
            <section className={cn(panelClass, "px-[18px] py-4")}>
              <h2 className="type-ui-title mb-1">Key moments</h2>
              {props.model.moments.length ? (
                props.model.moments.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => props.seek(m.at)}
                    className="flex w-full items-center gap-3 border-b border-by-border-engraved py-[11px] text-left hover:bg-by-surface-hover"
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-by-tile",
                        m.tone === "improve"
                          ? "bg-by-signal-improve-bg"
                          : m.tone === "regress"
                            ? "bg-by-signal-regress-bg"
                            : "bg-by-signal-attention-bg",
                        tones[m.tone],
                      )}
                    >
                      <Icon name={m.tone === "improve" ? "check" : "alert"} size={15} />
                    </span>
                    <span className="type-mono-data w-[46px] shrink-0 text-by-text-secondary">
                      {timeLabel(m.at)}
                    </span>
                    <span className="type-ui-small">{m.label}</span>
                  </button>
                ))
              ) : (
                <ReviewEmpty title="No key moments yet." />
              )}
            </section>
            <section className="flex flex-col gap-2.5">
              <h2 className="type-ui-title">Behavioral analysis</h2>
              {props.model.behaviors.length ? (
                [
                  props.model.behaviors[1],
                  props.model.behaviors[2],
                  props.model.behaviors[0],
                  props.model.behaviors[3],
                  props.model.behaviors[4],
                  {
                    ...props.model.behaviors[0],
                    name: "Next step",
                    value: props.review.analysis.nextSteps.join(" · ") || "None set",
                    detail: "From shared call analysis",
                    sampleSize: 1,
                    tone: props.review.analysis.nextSteps.length
                      ? ("improve" as const)
                      : ("attention" as const),
                  },
                ].map((b) => (
                  <article key={b.name} className={cn(panelClass, "flex gap-3 px-3.5 py-[11px]")}>
                    <span
                      className={cn(
                        "h-10 w-[3px] shrink-0 rounded-sm",
                        b.tone === "regress"
                          ? "bg-by-signal-regress"
                          : b.tone === "improve"
                            ? "bg-by-signal-improve"
                            : "bg-by-signal-attention",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="type-ui-small text-by-text-secondary">{b.name}</h3>
                        <ConfidenceMeter
                          level={b.confidence}
                          sampleSize={b.sampleSize}
                          className="gap-2"
                        />
                      </div>
                      <p className="type-ui-body-strong mt-0.5">{b.value}</p>
                      <p className={cn("type-ui-small mt-0.5", tones[b.tone])}>{b.detail}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className={cn(panelClass, "p-4")}>
                  <p className="type-ui-small">
                    {props.review.analysis.talkRatio !== null
                      ? `Talk / listen: ${Math.round(props.review.analysis.talkRatio * 100)} / ${Math.round((1 - props.review.analysis.talkRatio) * 100)}`
                      : "Detailed behavior analysis isn’t available for this call yet."}
                  </p>
                </div>
              )}
            </section>
          </div>
          <ReviewSummary {...props} />
        </>
      )}
    </ReviewScreen>
  );
}
import { panelClass, tones } from "./reviewStyle";
