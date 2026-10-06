import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Avatar,
  Button,
  ContextPanel,
  DataBoundary,
  EvidenceBlock,
  StateEmpty,
  StateError,
  SystemState,
  Tag,
  cn,
  systemStates,
} from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useAcknowledgeCoaching,
  useCoachingFoci,
  useMyCoaching,
  useCalls,
  useViewer,
  type CoachingFocus,
  type Viewer,
} from "@/lib/data";
import {
  LocalSettingsNote,
  LocalSettingsTable,
  cell,
} from "@/components/lanes/lane-5/settings/LocalSettings";
import { G1CoachingLifecycle } from "./G1CoachingLifecycle";
type Mode = "active" | "follow-up" | "completed";
const links = [
  ["active", "Active", "/app/coaching"],
  ["follow-up", "Needs follow-up", "/app/coaching/follow-up"],
  ["completed", "Completed", "/app/coaching/completed"],
] as const;
const completed = (f: CoachingFocus) => ["held", "not_yet", "reverted"].includes(f.status);
function LocalIndexError({ error, retry }: { error: unknown; retry: () => void }) {
  return error instanceof ForbiddenForRoleError ? (
    <SystemState
      {...systemStates.permissionDenied()}
      title="You don’t have access to this coaching list."
      body="Reps can view only their own coaching."
      actions={[]}
    />
  ) : (
    <StateError onRetry={retry} />
  );
}
export function LocalCoachingIndex({ mode }: { mode: Mode }) {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) =>
        person.role === "rep" ? (
          <LocalMyCoaching viewer={person} />
        ) : (
          <ManagerList mode={mode} viewer={person} />
        )
      }
    </DataBoundary>
  );
}
function ManagerList({ mode, viewer }: { mode: Mode; viewer: Viewer }) {
  const query = useCoachingFoci();
  return (
    <DataBoundary
      query={query}
      error={(error) => <LocalIndexError error={error} retry={() => void query.refetch()} />}
      empty={<StateEmpty title="No coaching focuses yet." />}
    >
      {(rows) => <ManagerContent rows={rows} viewer={viewer} mode={mode} />}
    </DataBoundary>
  );
}
function ManagerContent({
  rows,
  viewer,
  mode,
}: {
  rows: CoachingFocus[];
  viewer: Viewer;
  mode: Mode;
}) {
  const visible = rows.filter((f) =>
    mode === "active"
      ? !completed(f)
      : mode === "completed"
        ? completed(f)
        : ["not_yet", "reverted"].includes(f.status),
  );
  return (
    <main className="flex flex-col gap-5 px-9 py-7 text-by-text-primary max-md:px-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="type-editorial-h1">Coaching</h1>
          <p className="type-ui-small mt-2 text-by-text-secondary">
            A focus, evidence, acknowledgement and a measured result.
          </p>
        </div>
        {["manager", "owner", "admin", "coach"].includes(viewer.role) && (
          <Button asChild>
            <Link to="/app/coaching/assign" search={true}>
              New focus
            </Link>
          </Button>
        )}
      </header>
      <nav aria-label="Coaching lists" className="flex gap-5 border-b border-by-border-engraved">
        {links.map(([key, label, to]) => (
          <Link
            key={key}
            to={to}
            search={true}
            aria-current={mode === key ? "page" : undefined}
            className={cn(
              "type-ui-body border-b-2 py-2",
              mode === key ? "border-by-text-primary" : "border-transparent text-by-text-secondary",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {mode === "follow-up" && (
        <LocalSettingsNote title="Follow-up scope">
          Only recorded not-yet/reverted focuses are listed. Stalled progress, overdue check-ins and
          unopened-focus alerts aren’t supplied; no follow-up recommendation is inferred.
        </LocalSettingsNote>
      )}
      {visible.length ? (
        <LocalSettingsTable
          headings={[
            "REP",
            "FOCUS",
            mode === "completed" ? "RESULT" : "STATUS",
            "PROGRESS",
            "CHECK-IN",
            "",
          ]}
        >
          {visible.map((f) => (
            <tr key={f.id}>
              <td className={cell}>
                <span className="flex items-center gap-2">
                  <Avatar name={f.repName} size={22} />
                  {f.repName}
                </span>
              </td>
              <td className={cell}>{f.behaviorName}</td>
              <td className={cell}>
                <Tag tone="neutral">
                  {completed(f) ? "Result recorded · insight unavailable" : f.status}
                </Tag>
              </td>
              <td className={cell}>Unavailable</td>
              <td className={cell}>Unavailable</td>
              <td className={cell}>
                <Link
                  to="/app/coaching/$focusId"
                  params={{ focusId: f.id }}
                  search={true}
                  className="underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </LocalSettingsTable>
      ) : (
        <StateEmpty
          title={
            mode === "follow-up" ? "No recorded follow-up focuses." : "No focuses in this view."
          }
        />
      )}
      <LocalSettingsNote title="Measurement unavailable">
        No confidence, analyzed-call counts, progress series, comparison windows or held-duration
        contract. Behavioral results and fixed-range charts remain withheld. Active-focus capacity
        isn’t supplied; no cap or server enforcement is invented.
      </LocalSettingsNote>
      <details className="rounded-by-card border border-by-border-engraved bg-by-surface-raised">
        <summary className="type-ui-small cursor-pointer px-4 py-3">How coaching works</summary>
        <div className="overflow-x-auto">
          <G1CoachingLifecycle />
        </div>
      </details>
    </main>
  );
}
export function LocalMyCoachingScreen() {
  const viewer = useViewer();
  return (
    <DataBoundary query={viewer}>
      {(person) => <LocalMyCoaching key={`${person.id}:${person.role}`} viewer={person} />}
    </DataBoundary>
  );
}
function LocalMyCoaching({ viewer }: { viewer: Viewer }) {
  const query = useMyCoaching();
  return (
    <DataBoundary
      query={query}
      error={(error) => <LocalIndexError error={error} retry={() => void query.refetch()} />}
      empty={<StateEmpty title="No coaching assigned to you." />}
    >
      {(rows) => <MyContent viewer={viewer} focuses={rows.filter((f) => f.repId === viewer.id)} />}
    </DataBoundary>
  );
}
function MyContent({ focuses, viewer }: { focuses: CoachingFocus[]; viewer: Viewer }) {
  const active = focuses.filter((f) => !completed(f));
  const past = focuses.filter(completed);
  return (
    <main className="flex flex-col gap-5 px-9 py-7 text-by-text-primary max-md:px-6">
      <header>
        <h1 className="type-editorial-h1">My coaching</h1>
        <p className="type-ui-small mt-2 text-by-text-secondary">
          Your focus and evidence. Results appear when the evidence is sufficient.
        </p>
      </header>
      {!active.length && <StateEmpty title="No current focus." />}
      {active.map((f) => (
        <section
          key={f.id}
          className="flex flex-col gap-4 rounded-by-card bg-by-surface-rail p-7 text-by-text-on-dark"
        >
          <p className="type-mono-micro text-by-text-on-dark-muted">CURRENT FOCUS · {f.status}</p>
          <h2 className="type-editorial-h2">{f.behaviorName}</h2>
          <p className="type-ui-body">{f.note}</p>
          <p className="type-ui-small text-by-text-on-dark-muted">
            Before/after measurements are withheld: confidence and comparison windows aren’t
            supplied.
          </p>
          <Button variant="secondary" asChild>
            <Link to="/app/coaching/$focusId" params={{ focusId: f.id }} search={true}>
              View my focus
            </Link>
          </Button>
          <Acknowledgement focus={f} viewer={viewer} />
        </section>
      ))}
      {active.map((f) => (
        <OwnEvidence key={f.id} focus={f} viewer={viewer} />
      ))}
      <LocalSettingsNote title="Practice">
        Use your own attached call evidence. No practice script, peer example or generated coaching
        recommendation is supplied.
      </LocalSettingsNote>
      <h2 className="type-ui-label">PAST FOCUSES</h2>
      {past.length ? (
        <LocalSettingsTable headings={["FOCUS", "RESULT", "CHANGE", ""]}>
          {past.map((f) => (
            <tr key={f.id}>
              <td className={cell}>{f.behaviorName}</td>
              <td className={cell}>Insight unavailable</td>
              <td className={cell}>Confidence/windows unavailable</td>
              <td className={cell}>
                <Link to="/app/coaching/$focusId" params={{ focusId: f.id }} search={true}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </LocalSettingsTable>
      ) : (
        <StateEmpty title="No past focuses." />
      )}
      <ContextPanel title="Upcoming calls">
        <LocalSettingsNote title="Calendar unavailable">
          No calendar or upcoming-call contract is supplied. No appointments or likely objections
          are inferred.
        </LocalSettingsNote>
      </ContextPanel>
    </main>
  );
}
function OwnEvidence({ focus, viewer }: { focus: CoachingFocus; viewer: Viewer }) {
  const query = useCalls();
  return (
    <DataBoundary
      query={query}
      error={(error) => <LocalIndexError error={error} retry={() => void query.refetch()} />}
      empty={<StateEmpty title="No accessible call evidence." />}
    >
      {(calls) => {
        const safe = focus.evidence.filter((e) =>
          calls.some((c) => c.id === e.callId && c.repId === viewer.id),
        );
        return safe.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="type-ui-label">YOUR EVIDENCE</h2>
            {safe.map((e, i) => (
              <EvidenceBlock
                key={i}
                evidence={{
                  timestamp: e.timestamp,
                  speaker: e.speakerLabel,
                  quote: e.quote,
                  href: `/app/calls/${encodeURIComponent(e.callId)}/transcript#t=${e.tSeconds}`,
                }}
              />
            ))}
          </section>
        ) : (
          <StateEmpty title="No own clips attached." />
        );
      }}
    </DataBoundary>
  );
}
function Acknowledgement({ focus, viewer }: { focus: CoachingFocus; viewer: Viewer }) {
  const mutation = useAcknowledgeCoaching();
  const [notice, setNotice] = useState("");
  const [returned, setReturned] = useState(false);
  const acknowledge = async () => {
    if (mutation.isPending || returned || focus.repId !== viewer.id || focus.acknowledgedAt) return;
    try {
      const result = await mutation.mutateAsync(focus.id);
      if (
        !result ||
        result.id !== focus.id ||
        result.repId !== viewer.id ||
        result.status !== "acknowledged"
      ) {
        setNotice("Acknowledgement was not confirmed. Try again.");
        return;
      }
      setReturned(true);
      setNotice(
        "Acknowledgement returned by the hook. The current mock is a local preview; persistence and delivery are unconfirmed.",
      );
    } catch (error) {
      setNotice(
        error instanceof ForbiddenForRoleError
          ? "You can acknowledge only your own focus."
          : error instanceof Error
            ? error.message
            : "Acknowledgement failed. Try again.",
      );
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {focus.acknowledgedAt ? (
        <p className="type-ui-small">Already acknowledged.</p>
      ) : (
        <Button
          variant="secondary"
          disabled={mutation.isPending || returned}
          onClick={() => void acknowledge()}
        >
          {mutation.isPending ? "Acknowledging…" : "Acknowledge focus"}
        </Button>
      )}
      {notice && (
        <p role="status" className="type-ui-small">
          {notice}
        </p>
      )}
    </div>
  );
}
