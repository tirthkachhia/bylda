import { ConfidenceMeter, DataBoundary, Tag, cn } from "@/components/bylda";
import { useBehavioralEvents } from "@/lib/data";
import { ReviewScreen, Player, ReviewEmpty, ReviewRetry, type ReviewProps } from "./ReviewLayout";
import { timeLabel } from "./reviewModel";

export function C5CallReviewAnalysis() {
  return <ReviewScreen tab="analysis">{(props) => <Analysis {...props} />}</ReviewScreen>;
}
function Analysis(props: ReviewProps) {
  const events = useBehavioralEvents(props.review.call.id);
  return (
    <>
      <Player {...props} tab="analysis" />
      {props.model.behaviors.length ? (
        <div className="grid max-w-[1028px] items-start gap-4 lg:grid-cols-2">
          {props.model.behaviors.map((b) => (
            <article key={b.name} className={cn(panelClass, "px-4 py-3.5")}>
              <header className="mb-2 flex items-center justify-between gap-2">
                <h2 className="type-ui-title">{b.name}</h2>
                <Tag tone={b.tone}>{b.tag}</Tag>
              </header>
              <dl>
                {[
                  ["OBSERVATION", b.observation],
                  ["EVIDENCE", b.evidence],
                  ["INTERPRETATION", b.interpretation],
                  ...(b.confidence === "low" ? [] : [["DO NEXT", b.next]]),
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2.5 border-b border-by-border-engraved py-2">
                    <dt className="type-mono-micro w-[110px] shrink-0 text-by-text-tertiary">
                      {label}
                    </dt>
                    <dd className="type-ui-small min-w-0 flex-1">
                      {label === "EVIDENCE" ? (
                        <button
                          className="text-left hover:underline"
                          onClick={() => props.seek(b.at)}
                        >
                          {value}
                        </button>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <ConfidenceMeter
                level={b.confidence}
                sampleSize={b.sampleSize}
                className="mt-2 flex-wrap gap-2"
              />
            </article>
          ))}
        </div>
      ) : (
        <DataBoundary query={events} empty={<ReviewEmpty title="No behavioral events yet." />}>
          {(rows) => (
            <section className={cn(panelClass, "p-4")}>
              <h2 className="type-ui-title mb-3">Behavioral events</h2>
              {rows.map((event) => (
                <button
                  key={event.id}
                  className="type-ui-small flex w-full gap-4 border-b border-by-border-engraved py-3 text-left"
                  onClick={() => props.seek(event.tStart)}
                >
                  <span className="type-mono-data">{timeLabel(event.tStart)}</span>
                  <span>{event.type.replaceAll("_", " ")}</span>
                </button>
              ))}
            </section>
          )}
        </DataBoundary>
      )}
      {props.review.analysis.analysisStatus === "failed" && (
        <ReviewRetry callId={props.review.call.id} />
      )}
    </>
  );
}
import { panelClass } from "./reviewStyle";
