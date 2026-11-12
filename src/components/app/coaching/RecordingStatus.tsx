import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AudioLines, Check, CircleAlert, Clock3, FileQuestion } from "lucide-react";
import { formatWhen, loadCoachingCallsPage, type CoachingCall } from "@/lib/coaching/calls";
import { useCoachingWorkspaceAccess } from "@/lib/coaching/workspace-access";

const stages = {
  processing: { label: "Analyzing recordings", icon: Clock3 },
  interrupted: { label: "Analysis needs attention", icon: CircleAlert },
  insufficient: { label: "Feedback unavailable", icon: FileQuestion },
  ready: { label: "Feedback ready", icon: Check },
} as const;

function recordingState(call: Pick<CoachingCall, "coaching_stage" | "insight">) {
  const stage = call.coaching_stage ?? "";
  if (["queued", "transcribing", "transcribed", "scoring", "analyzing"].includes(stage))
    return "processing";
  if (stage.includes("failed")) return "interrupted";
  if (call.insight) return "ready";
  return "insufficient";
}

export function RecordingStatus({
  organizationId,
  first = false,
}: {
  organizationId: string;
  first?: boolean;
}) {
  const access = useCoachingWorkspaceAccess();
  const scope = { organizationId, repId: access.rep?.id ?? null, since: null };
  const query = useInfiniteQuery({
    queryKey: ["coaching-calls", scope],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => loadCoachingCallsPage(scope, pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled: Boolean(access.manager || access.rep),
    refetchInterval: (current) =>
      current.state.data?.pages.some((page) =>
        page.calls.some((call) => recordingState(call) === "processing"),
      )
        ? 10_000
        : false,
  });
  const calls = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.calls) ?? []).map((call) => [call.id, call]),
    ).values(),
  ];
  const firstCall = first ? calls[0] : undefined;
  const visible = firstCall ? [firstCall] : calls;
  return (
    <section
      className="page30-glass page30-setup-panel"
      data-design-screen={first ? "first-recording" : "recording-status"}
    >
      <header className="page30-section-header">
        <div>
          <p className="page30-label">Calls</p>
          <h1>{first ? "First recording" : "Recording status"}</h1>
          <p className="page30-muted">Review processing, recovery, and saved call feedback.</p>
        </div>
        <Link className="figma-button" to="/app/crm/calls">
          Back to Calls
        </Link>
      </header>
      {access.error || query.error ? (
        <p role="alert">
          Recording status could not load.{" "}
          <button
            className="underline"
            onClick={() => void (access.error ? access.retry() : query.refetch())}
          >
            Retry
          </button>
        </p>
      ) : access.pending || query.isLoading ? (
        <p role="status" className="page30-pending">
          Checking recording status…
        </p>
      ) : !access.manager && !access.rep ? (
        <p>Ask your manager to link your account to a rep profile to view your recordings.</p>
      ) : !calls.length ? (
        <div className="page30-status-card">
          <AudioLines size={20} aria-hidden="true" />
          <h2>Upload your first recording</h2>
          <p>Bylda will show feedback when usable analysis is available.</p>
          <Link
            className="figma-button page30-primary"
            to="/app/crm/calls"
            search={{ upload: true }}
          >
            Upload a recording
          </Link>
        </div>
      ) : (
        <>
          {Object.entries(stages).map(([state, { label, icon: Icon }]) => {
            const group = visible.filter((call) => recordingState(call) === state);
            if (!group.length) return null;
            return (
              <section key={state} className="page30-status-card" aria-label={label}>
                <h2>
                  <Icon size={18} aria-hidden="true" /> {label}
                </h2>
                {state === "processing" && (
                  <p role="status">Your recording is saved. Status refreshes while it processes.</p>
                )}
                {state === "insufficient" && (
                  <p>
                    There is no saved analysis for these recordings. Any retained transcript remains
                    available in the call.
                  </p>
                )}
                <ul className="page30-home-list">
                  {group.map((call) => (
                    <li key={call.id}>
                      <div>
                        <strong>{call.contactName}</strong>
                        <p className="page30-muted">
                          {formatWhen(call.started_at ?? call.created_at)}
                        </p>
                        {state === "interrupted" && (
                          <p role="status">
                            {call.coaching_error || "Processing was interrupted."}
                          </p>
                        )}
                        {state === "ready" && call.insight?.summary && (
                          <p>{call.insight.summary}</p>
                        )}
                      </div>
                      <Link
                        className={
                          state === "ready" ? "figma-button page30-primary" : "figma-button"
                        }
                        to="/app/crm/calls"
                        search={{ callId: call.id, repId: call.rep_id ?? undefined }}
                      >
                        {state === "ready"
                          ? "Open call insight"
                          : state === "interrupted"
                            ? "Review recovery options"
                            : "Open call"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {!first && query.hasNextPage && (
            <button
              className="figma-button"
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more recordings"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
