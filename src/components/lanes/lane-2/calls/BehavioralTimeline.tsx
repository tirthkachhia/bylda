import { cn } from "@/components/bylda";
import { demoTimeline, demoTiming, timeLabel } from "./reviewModel";
import { Player, type ReviewProps } from "./ReviewLayout";
import question from "./assets/C3-Ellipse.svg";
import objection from "./assets/C3-Polygon.svg";
import positive from "./assets/C3-Polygon1.svg";
import control from "./assets/C3-Vector.svg";
import sentiment from "./assets/C3-Vector1.svg";

/** Exact C3 track geometry from design-ref; presentation data is demo-only. */
export function BehavioralTimeline(props: ReviewProps) {
  const seekX = (x: number) => props.seek(((x - 80) / 944) * props.review.call.durationSec);
  return (
    <section
      aria-label="Behavioral timeline"
      className={cn(panelClass, "flex flex-col gap-2.5 px-5 py-4")}
    >
      <Player {...props} tab="transcript" compact={false} />
      {props.model.demo && !props.review.events.length ? (
        <div className="overflow-x-auto pt-[18px]">
          <div className="relative h-[218px] w-[1024px]">
            {["STAGE", "EVENTS", "TALK", "CONTROL", "SENTIMENT"].map((label, i) => (
              <div key={label}>
                <span
                  className="type-mono-micro absolute left-0 text-by-text-tertiary"
                  style={{ top: 8 + i * 38 }}
                >
                  {label}
                </span>
                <div
                  className="absolute left-20 h-px w-[944px] bg-by-border-engraved"
                  style={{ top: 30 + i * 38 }}
                />
              </div>
            ))}
            {demoTimeline.stages.map((stage) => (
              <div
                key={stage.x}
                className={cn(
                  "absolute top-1 h-[22px] border border-by-border-engraved",
                  stage.label === "Pricing" ? "bg-by-signal-regress-bg" : "bg-by-surface-inset",
                )}
                style={{ left: stage.x, width: stage.w }}
              >
                <span
                  className={cn(
                    "type-mono-micro absolute left-1 top-1 whitespace-nowrap",
                    stage.label === "Pricing" ? "text-by-signal-regress" : "text-by-text-secondary",
                  )}
                >
                  {stage.label}
                </span>
              </div>
            ))}
            {demoTimeline.questions.map((x) => (
              <button
                key={x}
                aria-label={`Question at ${timeLabel(((x - 80) / 944) * props.review.call.durationSec)}`}
                onClick={() => seekX(x)}
                className="absolute top-[52px]"
                style={{ left: x }}
              >
                <img src={question} alt="" className="max-w-none" />
              </button>
            ))}
            {demoTimeline.objections.map((x) => (
              <button
                key={x}
                aria-label={`Objection at ${timeLabel(((x - 80) / 944) * props.review.call.durationSec)}`}
                onClick={() => seekX(x)}
                className="absolute top-[48px]"
                style={{ left: x }}
              >
                <img src={objection} alt="" className="max-w-none" />
              </button>
            ))}
            {demoTimeline.interruptions.map((x) => (
              <button
                key={x}
                aria-label={`Interruption at ${timeLabel(((x - 80) / 944) * props.review.call.durationSec)}`}
                onClick={() => seekX(x)}
                className="absolute top-[46px] h-5 w-[1.5px] bg-by-signal-regress"
                style={{ left: x }}
              />
            ))}
            <button
              aria-label="Positive moment"
              onClick={() => props.seek(demoTiming.positive)}
              className="absolute left-[327.73px] top-[68px]"
            >
              <img src={positive} alt="" className="max-w-none" />
            </button>
            {demoTimeline.talk.slice(0, -1).map((x, i) => (
              <div
                key={x}
                className={cn(
                  "absolute h-[9px]",
                  demoTimeline.repTalk.includes(x)
                    ? "bg-by-surface-rail-active"
                    : "bg-by-border-control",
                )}
                style={{
                  left: x,
                  top: demoTimeline.repTalk.includes(x) ? 84 : 94,
                  width: demoTimeline.talk[i + 1] - x,
                }}
              />
            ))}
            <div className="absolute left-[550.27px] top-20 h-0.5 w-[42.01px] bg-by-signal-attention" />
            <img
              src={control}
              alt="Conversation control shifted after the objection"
              className="absolute left-20 top-[129.65px] max-w-none"
            />
            <span className="type-mono-micro absolute left-[228.27px] top-28 text-by-text-tertiary">
              prospect leads
            </span>
            <span className="type-mono-micro absolute left-[623.66px] top-[152px] text-by-signal-regress">
              rep pushing
            </span>
            <img
              src={sentiment}
              alt="Prospect sentiment cooled after the objection"
              className="absolute left-20 top-[167.17px] max-w-none"
            />
            <span className="type-mono-micro absolute left-[759.58px] top-[188px] text-by-signal-info">
              prospect cooling
            </span>
            <div
              className="absolute top-0 h-[196px] w-[1.5px] bg-by-surface-control-dark"
              style={{ left: 80 + (props.time / props.review.call.durationSec) * 944 }}
            >
              <span className="type-mono-micro absolute left-1 -top-[18px] whitespace-nowrap">
                {timeLabel(props.time)}
              </span>
            </div>
            <div className="type-mono-micro absolute inset-x-0 top-[208px] flex pl-20 text-by-text-tertiary">
              {demoTimeline.ticks.map((t) => (
                <span key={t} className="flex-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {props.review.events.map((e) => (
            <button
              key={e.id}
              className="type-mono-data rounded-by-control border border-by-border-engraved px-3 py-2"
              onClick={() => props.seek(e.tStart)}
            >
              {timeLabel(e.tStart)} · {e.type.replaceAll("_", " ")}
            </button>
          ))}
          {!props.review.events.length && (
            <p className="type-ui-small text-by-text-secondary">
              No timeline events available yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
import { panelClass } from "./reviewStyle";
