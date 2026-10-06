import { useParams } from "@tanstack/react-router";
import { Avatar, Button, DataBoundary, StateEmpty, Tag } from "@/components/bylda";
import {
  REP_INSIGHT_MIN_CALLS,
  OUTCOME_MIN_CLOSED,
  useCoachingFocus,
  useViewer,
  type CoachingFocus,
  type Viewer,
} from "@/lib/data";
import { LocalCoachingError, LocalCoachingDenied, LocalMissing } from "./LocalCoaching";

/** G12 — saved 14:224. Metadata never becomes an ungated behavioral insight. */
export function G12BehaviorChangeResultAlexMorgan() {
  const { focusId } = useParams({ strict: false });
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        focusId ? (
          <ResultData
            key={`${person.id}:${person.role}:${focusId}`}
            focusId={focusId}
            viewer={person}
          />
        ) : (
          <StateEmpty title="Choose a coaching focus." />
        )
      }
    </DataBoundary>
  );
}
function ResultData({ focusId, viewer }: { focusId: string; viewer: Viewer }) {
  const query = useCoachingFocus(focusId);
  return (
    <DataBoundary
      query={query}
      empty={
        <StateEmpty
          title="Focus unavailable."
          body="This focus may have been removed or is not available."
        />
      }
      error={(error) => <LocalCoachingError error={error} retry={() => void query.refetch()} />}
    >
      {(focus) =>
        !focus ? (
          <StateEmpty title="Focus unavailable." />
        ) : viewer.role === "rep" && focus.repId !== viewer.id ? (
          <LocalCoachingDenied />
        ) : focus.id !== focusId ? (
          <StateEmpty title="Focus changed." body="Reload to request the selected focus." />
        ) : (
          <ResultContent focus={focus} />
        )
      }
    </DataBoundary>
  );
}
function ResultContent({ focus }: { focus: CoachingFocus }) {
  const n = focus.result?.sampleSize;
  const knownSample = typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  return (
    <main className="flex flex-col gap-5 px-9 py-7 text-by-text-primary max-md:px-6">
      <p className="type-mono-micro text-by-text-tertiary">
        COACHING / RESULT /{" "}
        <span className="text-by-text-primary">
          {focus.repName.toUpperCase()} · {focus.behaviorName.toUpperCase()}
        </span>
      </p>
      <header className="flex min-h-24 items-center gap-4">
        <Avatar name={focus.repName} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="type-editorial-h1">
            {focus.result
              ? "Result recorded. Evidence is incomplete."
              : "The focus is still awaiting a result."}
          </h1>
          <p className="type-mono-data mt-2 text-by-text-secondary">Focus: “{focus.note}”</p>
        </div>
        <Tag tone="neutral">{focus.result ? "Insight unavailable" : "Awaiting result"}</Tag>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5 max-lg:grid-cols-1">
        <section className="flex min-h-[312px] flex-col rounded-by-card border border-by-border-engraved bg-by-surface-raised p-5">
          <h2 className="type-mono-micro text-by-text-tertiary">
            {focus.metric || "BEHAVIOR MEASUREMENT"} · PER CALL
          </h2>
          <div className="flex flex-1 items-center justify-center py-8">
            <StateEmpty
              title="Comparison chart unavailable."
              body="No before/after call series, comparison windows or fixed behavior range are supplied. Whole-call metrics cannot fill this gap."
            />
          </div>
          <p className="type-ui-small text-by-text-secondary">
            No measured points or baseline are inferred.
          </p>
        </section>
        <aside className="flex min-h-[464px] flex-col gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-5">
          <h2 className="type-ui-label">RESULT</h2>
          <LocalMissing>
            {focus.result
              ? "Result insight withheld until confidence and comparable measurement windows are available."
              : "No result has been measured yet."}
          </LocalMissing>
          <dl className="type-ui-small flex flex-col gap-3 text-by-text-secondary">
            <div>
              <dt>Sample size</dt>
              <dd className="type-mono-data text-by-text-primary">
                {knownSample ? `n = ${n} calls` : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd className="type-mono-micro">Unavailable · no insight or action</dd>
            </div>
          </dl>
          {knownSample && n < REP_INSIGHT_MIN_CALLS && (
            <p className="type-ui-small text-by-text-secondary">
              At least {REP_INSIGHT_MIN_CALLS} analyzed calls are needed for a rep insight. The
              contract also needs to confirm the analyzed-call count.
            </p>
          )}
          <p className="type-mono-micro text-by-text-tertiary">
            Outcome associations require at least {OUTCOME_MIN_CLOSED} closed calls and confidence.
            No outcome association is supplied.
          </p>
        </aside>
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        {["BEFORE", "AFTER"].map((label) => (
          <section
            key={label}
            className="flex flex-col gap-2 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4"
          >
            <h2 className="type-mono-micro text-by-text-tertiary">{label}</h2>
            <LocalMissing>
              No evidence is tagged to this comparison window. No clip or call link is inferred.
            </LocalMissing>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled>Close focus — mark as held</Button>
        <Button variant="secondary" disabled>
          Share win to #wins
        </Button>
        <Button variant="ghost" disabled>
          Pick next focus
        </Button>
      </div>
      <p className="type-ui-small text-by-text-secondary">
        Result actions are unavailable: evidence is incomplete and no public close or share mutation
        exists.
      </p>
    </main>
  );
}
