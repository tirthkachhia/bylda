import { useState, type ReactNode } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  EvidenceBlock,
  StateEmpty,
  StateError,
  SystemState,
  cn,
  systemStates,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  REP_INSIGHT_MIN_CALLS,
  useCalls,
  useCoachingFocus,
  useCoachingComments,
  useViewer,
  type CoachingFocus,
  type Viewer,
} from "@/lib/data";
import { LocalSettingsNote } from "@/components/lanes/lane-5/settings/LocalSettings";
import { LocalTextarea } from "@/components/lanes/lane-5/settings/LocalMethodology";

type View = "active" | "overview" | "evidence" | "progress" | "discussion";
const tabRoutes = [
  ["overview", "/app/coaching/$focusId/overview"],
  ["evidence", "/app/coaching/$focusId/evidence"],
  ["progress", "/app/coaching/$focusId/progress"],
  ["discussion", "/app/coaching/$focusId/discussion"],
] as const;
export function LocalCoachingDetail({ view }: { view: View }) {
  const { focusId } = useParams({ strict: false });
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        focusId ? (
          <DetailData
            key={`${person.id}:${person.role}:${focusId}`}
            focusId={focusId}
            viewer={person}
            view={view}
          />
        ) : (
          <StateEmpty title="Choose a coaching focus." />
        )
      }
    </DataBoundary>
  );
}
function LocalDenied() {
  return (
    <SystemState
      {...systemStates.permissionDenied()}
      title="You don’t have access to this coaching focus."
      body="Reps can view only their own coaching."
      actions={[]}
    />
  );
}
function LocalError({ error, retry }: { error: unknown; retry: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <LocalDenied />
  ) : (
    <StateError
      title="Coaching couldn’t load."
      body={error instanceof Error ? error.message : "Try again."}
      onRetry={retry}
    />
  );
}
function DetailData({ focusId, viewer, view }: { focusId: string; viewer: Viewer; view: View }) {
  const query = useCoachingFocus(focusId);
  return (
    <DataBoundary
      query={query}
      empty={<StateEmpty title="Focus unavailable." />}
      error={(error) => <LocalError error={error} retry={() => void query.refetch()} />}
    >
      {(focus) =>
        !focus ? (
          <StateEmpty title="Focus unavailable." />
        ) : viewer.role === "rep" && focus.repId !== viewer.id ? (
          <LocalDenied />
        ) : focus.id !== focusId ? (
          <StateEmpty title="Focus changed." body="Reload to request the selected focus." />
        ) : (
          <DetailContent focus={focus} viewer={viewer} view={view} />
        )
      }
    </DataBoundary>
  );
}
function LocalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4">
      <h2 className="type-ui-title">{title}</h2>
      {children}
    </section>
  );
}
function DetailContent({
  focus,
  viewer,
  view,
}: {
  focus: CoachingFocus;
  viewer: Viewer;
  view: View;
}) {
  return (
    <main className="flex flex-col gap-5 px-9 py-7 text-by-text-primary max-md:px-6">
      {view === "active" && (
        <p className="type-mono-micro text-by-text-tertiary">COACHING / FOCUS</p>
      )}
      <header className="flex items-center gap-4">
        <Avatar name={focus.repName} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="type-editorial-h1">
            {focus.repName} — {focus.behaviorName}
          </h1>
          <p className="type-ui-small mt-2 text-by-text-secondary">
            Assigned {dateLabel(focus.assignedAt)} ·{" "}
            {focus.acknowledgedAt
              ? `Acknowledged ${dateLabel(focus.acknowledgedAt)}`
              : "Not acknowledged"}
          </p>
        </div>
        {viewer.role !== "rep" && (
          <div className="flex gap-2">
            <Button variant="secondary" disabled>
              Edit
            </Button>
            <Button disabled>{view === "active" ? "End focus" : "Mark complete"}</Button>
          </div>
        )}
      </header>
      <nav
        aria-label="Coaching focus sections"
        className="flex flex-wrap gap-6 border-b border-by-border-engraved"
      >
        {tabRoutes.map(([key, to]) => (
          <Link
            key={key}
            to={to}
            params={{ focusId: focus.id }}
            search={true}
            aria-current={view === key ? "page" : undefined}
            className={cn(
              "type-ui-body border-b-2 py-2 capitalize",
              view === key ? "border-by-text-primary" : "border-transparent text-by-text-secondary",
            )}
          >
            {key}
          </Link>
        ))}
      </nav>
      {view === "active" && (
        <LocalCard title="Focus lifecycle">
          <ol className="grid grid-cols-5 gap-3 max-md:grid-cols-2">
            {[
              ["Assigned", dateLabel(focus.assignedAt)],
              ["Acknowledged", focus.acknowledgedAt ? dateLabel(focus.acknowledgedAt) : "Not yet"],
              ["Applying", focus.status === "measuring" ? "Measuring" : "Not confirmed"],
              ["Measured", focus.result ? "Result recorded" : "Not yet"],
              ["Result", "Insight unavailable"],
            ].map(([title, value]) => (
              <li key={title}>
                <p className="type-ui-body-strong">{title}</p>
                <p className="type-mono-micro mt-1 text-by-text-tertiary">{value}</p>
              </li>
            ))}
          </ol>
        </LocalCard>
      )}
      {(view === "overview" || view === "active") && (
        <>
          <div className="grid grid-cols-2 items-start gap-5 max-md:grid-cols-1">
            <LocalCard title={view === "active" ? "Measurement" : "Focus"}>
              <p className="type-editorial-insight">{focus.note}</p>
              <dl className="type-ui-small divide-y divide-by-border-engraved">
                {[
                  ["Behavior", focus.behaviorName],
                  ["Metric", focus.metric || "Unavailable"],
                  [
                    "Judged after",
                    focus.judgeAfter.calls !== null
                      ? `${focus.judgeAfter.calls} calls`
                      : focus.judgeAfter.date
                        ? dateLabel(focus.judgeAfter.date)
                        : "Unavailable",
                  ],
                  ["Baseline", "Unavailable — confidence and sample are missing"],
                  ["Check-in", "Unavailable"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-2">
                    <dt className="type-mono-micro text-by-text-tertiary">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </LocalCard>
            {view === "active" ? (
              <LoadedCalls focus={focus} viewer={viewer} />
            ) : (
              <EvidenceList focus={focus} viewer={viewer} />
            )}
          </div>
          <LocalSettingsNote title="Progress unavailable">
            No task/checklist completion or interim measurement contract. At least{" "}
            {REP_INSIGHT_MIN_CALLS} analyzed calls, sample and confidence are required before a rep
            insight. No progress percentage or verdict is inferred.
          </LocalSettingsNote>
        </>
      )}
      {(view === "evidence" || view === "active") && <EvidenceList focus={focus} viewer={viewer} />}
      {view === "progress" && (
        <>
          <LocalCard title={`${focus.behaviorName} · measurement`}>
            <div className="min-h-44">
              <StateEmpty
                title="Measurement series unavailable."
                body="No before/after windows, per-event series, confidence or fixed behavior range are supplied. No chart or change claim is inferred."
              />
            </div>
          </LocalCard>
          <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
            {["Before", "Since focus", "Target"].map((title) => (
              <LocalCard key={title} title={title}>
                <p className="type-ui-small text-by-text-secondary">
                  {title === "Target"
                    ? `${focus.target} · configured target; metric unit unavailable`
                    : "Measurement withheld: sample and confidence unavailable."}
                </p>
              </LocalCard>
            ))}
          </div>
          <LocalSettingsNote title="Also watching">
            Outcome associations and closed-call counts aren’t supplied. Associations below 30
            closed calls must remain hidden.
          </LocalSettingsNote>
        </>
      )}
      {view === "discussion" && <Discussion focus={focus} viewer={viewer} />}
      {view === "active" && (
        <ContextPanel title="Conversation">
          <Discussion focus={focus} viewer={viewer} />
        </ContextPanel>
      )}
      <p className="type-ui-small text-by-text-secondary">
        Focus editing and closing aren’t connected. No changes can be saved here.
      </p>
    </main>
  );
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      });
}
function EvidenceList({ focus, viewer }: { focus: CoachingFocus; viewer: Viewer }) {
  const calls = useCalls();
  return (
    <LocalCard title="Evidence attached">
      <DataBoundary
        query={calls}
        empty={<StateEmpty title="No accessible evidence calls." />}
        error={(error) => <LocalError error={error} retry={() => void calls.refetch()} />}
      >
        {(rows) => {
          const safe = focus.evidence.filter((e) =>
            rows.some((c) => c.id === e.callId && (viewer.role !== "rep" || c.repId === viewer.id)),
          );
          return safe.length ? (
            safe.map((e, index) => (
              <EvidenceBlock
                key={`${e.callId}:${index}`}
                evidence={{
                  timestamp: e.timestamp,
                  speaker: e.speakerLabel,
                  quote: e.quote,
                  href: `/app/calls/${encodeURIComponent(e.callId)}/transcript#t=${e.tSeconds}`,
                }}
              />
            ))
          ) : (
            <StateEmpty
              title="No accessible clips attached."
              body="No example or comparison clip is inferred."
            />
          );
        }}
      </DataBoundary>
    </LocalCard>
  );
}
function LoadedCalls({ focus, viewer }: { focus: CoachingFocus; viewer: Viewer }) {
  const query = useCalls();
  return (
    <LocalCard title="Loaded calls after assignment">
      <DataBoundary
        query={query}
        empty={<StateEmpty title="No calls available." />}
        error={(error) => <LocalError error={error} retry={() => void query.refetch()} />}
      >
        {(rows) => {
          const safe = rows.filter(
            (c) =>
              c.repId === focus.repId &&
              (viewer.role !== "rep" || c.repId === viewer.id) &&
              new Date(c.startedAt).getTime() >= new Date(focus.assignedAt).getTime(),
          );
          return safe.length ? (
            <ul className="divide-y divide-by-border-engraved">
              {safe.map((c) => (
                <li key={c.id} className="py-3">
                  <Link
                    search={true}
                    to="/app/calls/$callId"
                    params={{ callId: c.id }}
                    className="type-ui-body-strong underline"
                  >
                    {c.account.name}
                  </Link>
                  <p className="type-mono-micro mt-1 text-by-text-tertiary">
                    {dateLabel(c.startedAt)} · {c.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <StateEmpty title="No loaded calls in this period." />
          );
        }}
      </DataBoundary>
      <p className="type-ui-small text-by-text-secondary">
        Filtered by call start time; no per-call coaching progress is supplied.
      </p>
    </LocalCard>
  );
}
function Discussion({ focus, viewer }: { focus: CoachingFocus; viewer: Viewer }) {
  const query = useCoachingComments(focus.id);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-5">
      <DataBoundary
        query={query}
        empty={<StateEmpty title="No discussion yet." />}
        error={(error) => <LocalError error={error} retry={() => void query.refetch()} />}
      >
        {(comments) => {
          const safe = comments.filter(
            (c) =>
              c.focusId === focus.id &&
              (viewer.role !== "rep" ||
                c.authorId === viewer.id ||
                c.authorId === focus.assignedById),
          );
          return safe.length ? (
            safe.map((c) => (
              <LocalCard key={c.id} title={c.authorName}>
                <div className="flex items-start gap-3">
                  <Avatar name={c.authorName} size={28} />
                  <div>
                    <p className="type-mono-micro text-by-text-tertiary">
                      {dateLabel(c.createdAt)}
                    </p>
                    <p className="type-ui-body mt-1">{c.body}</p>
                  </div>
                </div>
              </LocalCard>
            ))
          ) : (
            <StateEmpty title="No accessible discussion." />
          );
        }}
      </DataBoundary>
      <LocalTextarea label="Reply draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <p className="type-ui-small text-by-text-secondary">
        Unsaved draft. Posting comments isn’t connected.
      </p>
      <div className="flex gap-2">
        <Button disabled>Send reply</Button>
        <Button variant="ghost" onClick={() => setDraft("")} disabled={!draft}>
          Clear draft
        </Button>
      </div>
    </div>
  );
}
