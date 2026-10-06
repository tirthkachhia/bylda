import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn, ConfidenceMeter, EvidenceBlock, Button, Tag } from "@/components/bylda";
import {
  ReviewScreen,
  ReviewSummary,
  ReviewEmpty,
  ReviewRetry,
  type ReviewProps,
} from "./ReviewLayout";
import { BehavioralTimeline } from "./BehavioralTimeline";
import { timeLabel, demoAnnotations } from "./reviewModel";

export function C3CallReviewTranscriptTimeline() {
  return <ReviewScreen tab="transcript">{(props) => <Transcript {...props} />}</ReviewScreen>;
}
function Transcript(props: ReviewProps) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("Analysis");
  const rows = props.model.transcript.filter(
    (s) =>
      s.text.toLowerCase().includes(search.toLowerCase()) ||
      s.speakerName.toLowerCase().includes(search.toLowerCase()),
  );
  const leak = props.model.behaviors[0];
  return (
    <>
      <ReviewSummary {...props} detailed />
      <BehavioralTimeline {...props} />
      <div className="grid items-start gap-5 lg:grid-cols-[1.088fr_1fr]">
        <section className={cn(panelClass, "overflow-hidden")}>
          <header className="flex items-center justify-between gap-3 border-b border-by-border-engraved px-[18px] py-3">
            <h2 className="type-ui-label">TRANSCRIPT</h2>
            <input
              type="search"
              aria-label="Search transcript"
              placeholder="Search transcript   ⌘F"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="type-mono-micro min-w-0 max-w-[190px] bg-transparent text-by-text-secondary outline-offset-4"
            />
          </header>
          {rows.length ? (
            rows.map((s) => (
              <button
                key={s.id}
                onClick={() => props.seek(s.tStart)}
                className={cn(
                  "flex w-full gap-3 border-b border-by-border-engraved px-[18px] py-[11px] text-left last:border-b-0 hover:bg-by-surface-hover",
                  props.review.events.some((e) => e.type === "objection" && e.tStart === s.tStart)
                    ? "bg-by-signal-attention-bg"
                    : props.review.events.some(
                          (e) => e.type === "interruption" && e.tStart === s.tStart,
                        )
                      ? "bg-by-signal-regress-bg"
                      : "",
                )}
              >
                <span className="flex w-[94px] shrink-0 flex-col gap-1">
                  <span className="type-mono-data text-by-text-secondary">
                    {timeLabel(s.tStart)}
                  </span>
                  <span
                    className={cn(
                      "type-mono-micro",
                      s.speaker === "rep" ? "text-by-text-primary" : "text-by-text-tertiary",
                    )}
                  >
                    {s.speakerName.toUpperCase()}
                  </span>
                </span>
                <span className="type-ui-body min-w-0 flex-1">
                  <span className={s.speaker === "rep" ? "" : "text-by-text-secondary"}>
                    {s.text}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <ReviewEmpty
              title={search ? "No matching transcript lines." : "No transcript available."}
            />
          )}
        </section>
        <section className={cn(panelClass, "p-[18px]")}>
          <nav
            aria-label="Transcript analysis"
            className="-mx-[18px] -mt-[18px] mb-4 flex gap-[18px] border-b border-by-border-engraved px-[18px]"
          >
            {["Analysis", "Behaviors", "Methodology", "Notes"].map((t) => (
              <button
                key={t}
                aria-pressed={active === t}
                onClick={() => setActive(t)}
                className={cn(
                  "type-ui-body py-3",
                  active === t ? "border-b border-by-text-primary" : "text-by-text-secondary",
                )}
              >
                {t}
              </button>
            ))}
          </nav>
          {active === "Analysis" && (
            <>
              {leak ? (
                <>
                  <h2 className="type-ui-label mb-4 text-by-signal-regress">
                    WHERE THE CALL WAS LOST
                  </h2>
                  <div className="rounded-by-card border border-by-border-engraved bg-by-surface-inset p-3.5">
                    <dl className="flex flex-col gap-3">
                      {[
                        ["OBSERVATION", leak.observation],
                        ["INTERPRETATION", leak.interpretation],
                        ...(leak.confidence === "low" ? [] : [["DO THIS NEXT TIME", leak.next]]),
                      ].map(([l, v]) => (
                        <div key={l} className="flex gap-3">
                          <dt className="type-mono-micro w-24 shrink-0 text-by-text-tertiary">
                            {l}
                          </dt>
                          <dd className="type-ui-small">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <button className="mt-3 w-full text-left" onClick={() => props.seek(leak.at)}>
                      <EvidenceBlock
                        evidence={{
                          timestamp: timeLabel(leak.at),
                          speaker: "Evidence",
                          quote:
                            props.model.transcript.find((s) => s.tStart === leak.at)?.text ??
                            leak.evidence,
                        }}
                      />
                    </button>
                    <ConfidenceMeter
                      level={leak.confidence}
                      sampleSize={leak.sampleSize}
                      sampleLabel={demoAnnotations.sample}
                      className="mt-3 flex-wrap gap-2"
                    />
                  </div>
                  <h3 className="type-ui-label mb-4 mt-4 text-by-signal-improve">WHAT WENT WELL</h3>
                  <p className="type-ui-small">{props.model.good}</p>
                </>
              ) : (
                <p className="type-ui-small">
                  {props.review.analysis.summary ?? "No analysis available yet."}
                </p>
              )}
              <h3 className="type-ui-label mb-3 mt-4">BEHAVIORS ON THIS CALL</h3>
              <BehaviorRows {...props} />
            </>
          )}
          {active === "Behaviors" && <BehaviorRows {...props} />}
          {active === "Methodology" &&
            (props.review.analysis.methodologyAdherence.length ? (
              <dl>
                {props.review.analysis.methodologyAdherence.map((s) => (
                  <div
                    key={s.stage}
                    className="type-ui-small flex justify-between border-b border-by-border-engraved py-3"
                  >
                    <dt>{s.stage}</dt>
                    <dd>{Math.round(s.score * 100)}%</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ReviewEmpty title="No methodology evidence yet." />
            ))}
          {active === "Notes" && (
            <>
              <p className="type-ui-small mb-3">Timestamped coach notes are on the Coaching tab.</p>
              <Button variant="secondary" asChild>
                <Link
                  to="/app/calls/$callId/coaching"
                  params={{ callId: props.review.call.id }}
                  hash="note"
                >
                  Open coaching notes
                </Link>
              </Button>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/app/calls/$callId"
              params={{ callId: props.review.call.id }}
              className="type-ui-small text-by-text-secondary hover:underline"
            >
              Overview
            </Link>
            <Link
              to="/app/calls/$callId/analysis"
              params={{ callId: props.review.call.id }}
              className="type-ui-small text-by-text-secondary hover:underline"
            >
              Full analysis
            </Link>
          </div>
        </section>
      </div>
      {props.review.analysis.analysisStatus === "failed" && (
        <ReviewRetry callId={props.review.call.id} />
      )}
    </>
  );
}
function BehaviorRows(props: ReviewProps) {
  return props.model.behaviors.length ? (
    <div>
      {props.model.behaviors.map((b) => (
        <div
          key={b.name}
          className="type-ui-small flex items-start gap-3 border-b border-by-border-engraved py-2"
        >
          <span className="w-[126px] shrink-0">{b.name}</span>
          <span className="min-w-0 flex-1 text-by-text-secondary">{b.observation}</span>
          <Tag tone={b.tone}>{b.tag}</Tag>
        </div>
      ))}
    </div>
  ) : (
    <ReviewEmpty title="No detailed behaviors available." />
  );
}
import { panelClass } from "./reviewStyle";
