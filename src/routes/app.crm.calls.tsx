import { type SearchSchemaInput, createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  assignRepPlaybook,
  deleteCall,
  playbooksQuery,
  repsQuery,
  repByIdQuery,
  rescoreCall,
} from "@/lib/queries";
import { coachingCallQuery, loadCoachingCallsPage, initials } from "@/lib/coaching/calls";
import {
  behaviorEventsQuery,
  behaviorRunSourceQuery,
  BEHAVIOR_LABELS,
} from "@/lib/coaching/behavior";
import {
  parseCallSourceTarget,
  resolveBehaviorSource,
  type CallSourceTarget,
} from "@/lib/coaching/source-navigation";
import {
  callsSearchFromSource,
  readCallsSearch,
  type CallsSearch,
} from "@/lib/coaching/calls-search";
import { RepPicker } from "@/components/app/coaching/RepPicker";
import { BulkCallUpload } from "@/components/app/coaching/BulkCallUpload";
import { CallList } from "@/components/app/coaching/CallList";
import { CallDetail } from "@/components/app/coaching/CallDetail";
import { PlaybooksPanel } from "@/components/app/coaching/PlaybooksPanel";
import { RepReportPanel } from "@/components/app/coaching/RepReportPanel";
export const Route = createFileRoute("/app/crm/calls")({
  validateSearch: (input: Record<string, unknown> & SearchSchemaInput) => readCallsSearch(input),
  component: CallsPage,
});
const inFlight = (stage: string | null) =>
  ["queued", "transcribing", "scoring", "analyzing"].includes(stage ?? "");
function CallsPage() {
  const { currentOrgId, user } = useAuth();
  return currentOrgId && user ? (
    <CallsWorkspace key={currentOrgId} organizationId={currentOrgId} userId={user.id} />
  ) : null;
}
function CallsWorkspace({ organizationId, userId }: { organizationId: string; userId: string }) {
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    qc = useQueryClient();
  const scopeRef = useRef(organizationId);
  useEffect(() => {
    scopeRef.current = organizationId;
    return () => {
      scopeRef.current = "";
    };
  }, [organizationId]);
  const [text, setText] = useState(search.q ?? ""),
    [days, setDays] = useState(0),
    [now] = useState(Date.now),
    [showFilters, setShowFilters] = useState(false),
    [family, setFamily] = useState("all"),
    [stage, setStage] = useState("all"),
    [analysisFilter, setAnalysisFilter] = useState("all"),
    [showUpload, setShowUpload] = useState(false),
    [uploadRep, setUploadRep] = useState<string | null>(null);
  useEffect(() => setText(search.q ?? ""), [search.q]);
  const update = (patch: Partial<CallsSearch>, replace = false) =>
    void navigate({ search: { ...search, ...patch, sourceError: undefined }, replace });
  const clearSource = () =>
    update({
      callId: undefined,
      runId: undefined,
      turnId: undefined,
      eventId: undefined,
      at: undefined,
      tab: undefined,
      reportId: undefined,
    });
  const reps = useQuery(repsQuery(organizationId)),
    playbooks = useQuery(playbooksQuery(organizationId));
  const historicalRep = useQuery(repByIdQuery(organizationId, search.repId ?? null));
  const rep = reps.data?.find((r) => r.id === search.repId) ?? historicalRep.data ?? null;
  const scope = useMemo(
    () => ({
      organizationId,
      repId: search.repId ?? null,
      since: days ? new Date(now - days * 86400_000).toISOString() : null,
    }),
    [organizationId, search.repId, days, now],
  );
  const list = useInfiniteQuery({
    queryKey: ["coaching-calls", scope],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => loadCoachingCallsPage(scope, pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled: search.view === "calls",
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.calls.some((c) => inFlight(c.coaching_stage)))
        ? 10_000
        : false,
  });
  const calls = [
    ...new Map(
      (list.data?.pages.flatMap((page) => page.calls) ?? []).map((call) => [call.id, call]),
    ).values(),
  ];
  const selected = useQuery({
    ...coachingCallQuery(organizationId, search.sourceError ? null : (search.callId ?? null)),
    refetchInterval: (query) =>
      inFlight(query.state.data?.coaching_stage ?? null) ? 10_000 : false,
  });
  const call = selected.data ?? null;
  const previousStage = useRef<string | null>(null);
  useEffect(() => {
    if (
      previousStage.current &&
      inFlight(previousStage.current) &&
      call &&
      !inFlight(call.coaching_stage)
    ) {
      void qc.invalidateQueries({ queryKey: ["call-scores", call.id] });
      void qc.invalidateQueries({ queryKey: ["rep-behavior"] });
      void qc.invalidateQueries({ queryKey: ["behavior-manager-home"] });
    }
    previousStage.current = call?.coaching_stage ?? null;
  }, [call, qc]);
  const runId = search.runId ?? call?.insight?.vertical_insights?.behavior_analysis?.run_id ?? null;
  const sourceTarget: CallSourceTarget | null =
    call && runId
      ? {
          organizationId,
          repId: search.repId ?? call.rep_id,
          callId: call.id,
          startSeconds: search.at ?? null,
          source: {
            kind: "behavior",
            runId,
            ...(search.turnId !== undefined ? { turnId: search.turnId } : {}),
            ...(search.eventId ? { eventId: search.eventId } : {}),
          },
        }
      : null;
  const source = useQuery(behaviorRunSourceQuery(sourceTarget));
  const sourceEvents = useQuery(
    behaviorEventsQuery(search.eventId && runId ? runId : null, organizationId),
  );
  const requestedEvent = sourceEvents.data?.find((e) => e.id === search.eventId);
  const eventValid =
    !search.eventId ||
    (!!requestedEvent &&
      requestedEvent.run_id === runId &&
      requestedEvent.call_id === call?.id &&
      (search.turnId === undefined ||
        [
          ...requestedEvent.evidence.rep,
          ...requestedEvent.evidence.buyer,
          ...requestedEvent.evidence.context,
        ].some((e) => e.turn_id === search.turnId)));
  const resolution =
    sourceTarget && source.data ? resolveBehaviorSource(sourceTarget, source.data) : null;
  const sourceLoading =
    !!sourceTarget && (source.isPending || (!!search.eventId && sourceEvents.isPending));
  const sourceReady =
    resolution?.status === "available" && eventValid && !source.error && !sourceEvents.error;
  const visible = calls.filter(
    (c) =>
      `${c.contactName} ${c.company} ${c.repName ?? ""} ${c.dealName ?? ""}`
        .toLowerCase()
        .includes(text.toLowerCase()) &&
      (stage === "all" || c.dealStage === stage) &&
      (analysisFilter === "all" || (analysisFilter === "analyzed" ? !!c.insight : !c.insight)) &&
      (family === "all" ||
        c.insight?.vertical_insights?.behavior_analysis?.events?.some(
          (e: { family: string }) => e.family === family,
        )),
  );
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["coaching-calls"] }),
      qc.invalidateQueries({ queryKey: ["coaching-call"] }),
      qc.invalidateQueries({ queryKey: ["behavior-manager-home"] }),
      qc.invalidateQueries({ queryKey: ["rep-behavior"] }),
      qc.invalidateQueries({ queryKey: ["figma-rep-call-counts"] }),
      qc.invalidateQueries({ queryKey: ["call-scores"] }),
    ]);
  }
  async function openSource(input: CallSourceTarget) {
    let target = parseCallSourceTarget(input);
    if (target.organizationId !== scopeRef.current)
      throw new Error("Source belongs to another workspace.");
    const found = await qc.fetchQuery(coachingCallQuery(organizationId, target.callId));
    if (!found || found.rep_id !== target.repId)
      throw new Error("The cited call is unavailable for this rep. No other call was opened.");
    if (target.source.kind === "behavior") {
      const identity = target.source;
      if (target.source.eventId) {
        const events = await qc.fetchQuery(
          behaviorEventsQuery(target.source.runId, organizationId),
        );
        const event = events.find((e) => e.id === identity.eventId);
        if (!event || event.call_id !== target.callId || event.rep_id !== target.repId)
          throw new Error("The cited event is unavailable.");
        if (
          target.source.turnId !== undefined &&
          ![...event.evidence.context, ...event.evidence.rep, ...event.evidence.buyer].some(
            (e) => e.turn_id === identity.turnId,
          )
        )
          throw new Error("Source turn does not belong to the cited event.");
        target = {
          ...target,
          source: {
            ...target.source,
            turnId: target.source.turnId ?? event.evidence.rep[0]?.turn_id,
          },
        };
      }
      const retained = await qc.fetchQuery(behaviorRunSourceQuery(target));
      if (resolveBehaviorSource(target, retained).status !== "available")
        throw new Error("The cited analysis snapshot is unavailable.");
    }
    if (target.organizationId !== scopeRef.current)
      throw new Error("Workspace changed before the source could open.");
    await navigate({ search: callsSearchFromSource(target) });
  }
  const openLegacy = (id: string, seconds?: number | null) => {
    void openSource({
      organizationId,
      repId: rep?.id ?? null,
      callId: id,
      startSeconds: seconds ?? null,
      source: { kind: "call" },
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Source unavailable"));
  };
  async function changePlaybook(value: string) {
    if (!rep) return;
    try {
      await assignRepPlaybook(rep.id, value || null);
      await qc.invalidateQueries({ queryKey: ["reps", organizationId] });
      toast.success("Playbook updated. Re-analyze calls to apply the new assignment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign playbook");
    }
  }
  const title =
    search.view === "playbooks"
      ? "Methodology"
      : search.view === "report"
        ? "Coaching reports"
        : search.view === "people"
          ? "People"
          : search.view === "insights"
            ? "Behavioral insights"
            : "Calls";
  return (
    <div className="space-y-5" data-design-screen="calls-workspace">
      {search.view !== "playbooks" &&
        !search.callId &&
        !(search.repId && search.view !== "calls") && (
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl">
                {search.callId && search.view === "calls" ? "Call review" : title}
              </h1>
              <p className="mt-2 text-[13px] text-by-text-secondary">
                {search.view === "calls"
                  ? "Understand what happened, with the evidence to hear it."
                  : "Select a rep to review their behavioral evidence and coaching reports."}
              </p>
            </div>
            <div className="flex gap-2">
              {search.view === "calls" && (
                <>
                  <button
                    type="button"
                    disabled={list.isFetching || selected.isFetching}
                    onClick={() => void refresh()}
                    aria-label="Refresh calls"
                    className="rounded-md border border-by-border-control bg-white p-2.5 disabled:opacity-40"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpload(!(showUpload || search.upload));
                      update({ upload: undefined });
                    }}
                    className="flex items-center gap-2 rounded-md border border-by-border-control bg-white px-3 py-2 text-xs"
                  >
                    <Upload size={14} />
                    {showUpload || search.upload ? "Hide upload" : "Upload calls"}
                  </button>
                </>
              )}
            </div>
          </header>
        )}

      {search.view === "playbooks" ? (
        <section className="rounded-xl border border-by-border-engraved bg-white p-5 sm:p-8">
          <PlaybooksPanel key={organizationId} />
        </section>
      ) : search.view !== "calls" ? (
        <>
          <div className="max-w-sm">
            <RepPicker
              organizationId={organizationId}
              userId={userId}
              value={rep?.id ?? null}
              onChange={(id) => update({ repId: id ?? undefined, reportId: undefined })}
            />
          </div>
          {rep?.status !== "active" && rep && (
            <p className="text-xs text-by-text-secondary">Viewing archived rep history.</p>
          )}
          {rep ? (
            <RepReportPanel
              key={`${rep.id}:${search.reportId ?? ""}:${search.view}`}
              repId={rep.id}
              repName={rep.name}
              onOpenCall={openLegacy}
              onOpenSource={openSource}
              initialReportId={search.reportId}
              onViewChange={(view) =>
                update({ view: view === "reports" ? "report" : "people", reportId: undefined })
              }
              onSelectReport={(id) => update({ view: "report", reportId: id })}
              initialView={search.view === "report" ? "reports" : "profile"}
              initialProfileTab={search.view === "insights" ? "Trends" : "Overview"}
            />
          ) : (
            <section className="rounded-xl border border-by-border-engraved bg-white p-6">
              <h2 className="text-lg">
                {reps.isPending || (search.repId && historicalRep.isPending)
                  ? "Loading reps…"
                  : reps.error || historicalRep.error
                    ? "Rep list unavailable"
                    : search.repId
                      ? "Requested rep is unavailable for this workspace"
                      : "Choose a rep"}
              </h2>
              <p className="mt-2 text-sm text-by-text-secondary">
                Review a rep’s source-backed behaviors, reports and playbook assignment.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reps.data?.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => update({ repId: r.id })}
                    className="flex items-center gap-3 rounded-xl border border-by-border-engraved p-4 text-left text-sm"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-by-avatar-metal text-xs">
                      {initials(r.name)}
                    </span>
                    {r.name} →
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {(showUpload || search.upload) && (
            <section className="space-y-4 rounded-xl border border-by-border-engraved bg-white p-5">
              <div className="max-w-sm">
                <label className="mb-2 block text-xs font-medium">Rep for these recordings</label>
                <RepPicker
                  organizationId={organizationId}
                  userId={userId}
                  value={uploadRep ?? rep?.id ?? null}
                  onChange={setUploadRep}
                />
              </div>
              {uploadRep || rep?.id ? (
                <BulkCallUpload
                  key={uploadRep ?? rep?.id}
                  organizationId={organizationId}
                  userId={userId}
                  repId={(uploadRep ?? rep?.id)!}
                  repName={
                    reps.data?.find((r) => r.id === (uploadRep ?? rep?.id))?.name ?? "selected rep"
                  }
                  onImported={() => void refresh()}
                />
              ) : (
                <p className="text-sm text-by-text-secondary">
                  Choose or create a rep before uploading recordings.
                </p>
              )}
            </section>
          )}
          {search.sourceError ? (
            <SourceUnavailable message={search.sourceError} onBack={clearSource} />
          ) : search.callId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={clearSource}
                  className="flex items-center gap-2 text-xs"
                >
                  <ArrowLeft size={14} /> Back to calls
                </button>
                {rep?.status === "active" && (
                  <label className="flex flex-wrap items-center gap-2 text-xs">
                    Rep playbook
                    <select
                      aria-label="Rep playbook"
                      value={rep.playbook_id ?? ""}
                      onChange={(event) => void changePlaybook(event.target.value)}
                      className="max-w-64 rounded-md border border-by-border-control bg-white p-2"
                    >
                      <option value="">
                        {playbooks.data?.length === 1
                          ? `Default (${playbooks.data[0].name})`
                          : "None assigned"}
                      </option>
                      {playbooks.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · v{p.current?.version ?? "?"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {search.reportId && !search.runId && (
                <p className="rounded-lg border border-by-border-engraved bg-white p-3 text-xs leading-5 text-by-text-secondary">
                  Opened from a report citation. This report does not retain an analysis-run ID; the
                  call’s currently available source is shown. Its transcript may differ from the
                  quote retained in the report.
                </p>
              )}
              {selected.isPending ? (
                <p
                  role="status"
                  className="rounded-xl border border-by-border-engraved bg-white p-8 text-sm"
                >
                  Loading the source call…
                </p>
              ) : selected.error || !call || (search.repId && call.rep_id !== search.repId) ? (
                <SourceUnavailable
                  message="The requested call is unavailable for this workspace or rep."
                  onBack={clearSource}
                />
              ) : (
                <CallDetail
                  key={call.id}
                  call={call}
                  tab={search.tab ?? "summary"}
                  onTab={(tab) => update({ tab }, true)}
                  seekSeconds={search.at ?? null}
                  seekRequest={search.turnId ?? 0}
                  sourceTurns={
                    sourceReady && resolution?.status === "available" ? resolution.turns : null
                  }
                  sourceAnalysis={sourceReady ? (source.data?.analysis ?? null) : null}
                  sourceRunId={sourceReady ? runId : null}
                  sourceState={
                    sourceLoading
                      ? "loading"
                      : sourceTarget
                        ? sourceReady
                          ? "ready"
                          : "unavailable"
                        : "legacy"
                  }
                  highlightedTurnId={
                    sourceReady && resolution?.status === "available"
                      ? resolution.highlightedTurnId
                      : null
                  }
                  focusedOccurrenceKey={requestedEvent?.assessment.occurrence_key ?? null}
                  onReanalyze={async (id) => {
                    await rescoreCall(id);
                    await refresh();
                  }}
                  onDelete={async (id) => {
                    const result = await deleteCall(id, call.audio_path);
                    if (call.audio_path && !result.audioRemoved)
                      toast.warning("Call deleted; its audio could not be removed from storage.");
                    else toast.success("Call deleted");
                    clearSource();
                    await refresh();
                  }}
                />
              )}
            </>
          ) : (
            <>
              <section className="space-y-4 rounded-xl border border-by-border-engraved bg-gradient-to-br from-by-surface-sidebar via-white to-by-surface-hover p-4">
                <div className="flex flex-wrap items-end gap-5">
                  <div>
                    <label className="mb-2 block text-xs font-medium">Whose calls</label>
                    <select
                      aria-label="Whose calls"
                      value={search.repId ?? ""}
                      onChange={(event) => update({ repId: event.target.value || undefined })}
                      className="rounded-md border border-by-border-control bg-white px-3 py-2 text-[13px]"
                    >
                      <option value="">Everyone</option>
                      {reps.data?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium">Which calls</label>
                    <select
                      aria-label="Analysis status"
                      value={analysisFilter}
                      onChange={(event) => setAnalysisFilter(event.target.value)}
                      className="rounded-md border border-by-border-control bg-white px-3 py-2 text-[13px]"
                    >
                      <option value="all">All loaded calls</option>
                      <option value="analyzed">Analyzed</option>
                      <option value="pending">Awaiting analysis</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium">Time</label>
                    <select
                      aria-label="Call date range"
                      value={days}
                      onChange={(event) => setDays(Number(event.target.value))}
                      className="rounded-md border border-by-border-control bg-white px-3 py-2 text-[13px]"
                    >
                      {[
                        [0, "All time"],
                        [7, "Last 7 days"],
                        [30, "Last 30 days"],
                        [90, "Last 90 days"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    aria-expanded={showFilters}
                    onClick={() => setShowFilters((v) => !v)}
                    className="rounded-md border border-by-border-control bg-white px-3 py-2 text-xs"
                  >
                    {showFilters ? "Hide filters" : "More filters"}
                  </button>
                </div>
                <p className="text-[13px] font-medium">
                  {calls.length} loaded
                  {list.data?.pages[0]?.total !== null && list.data?.pages[0]?.total !== undefined
                    ? ` of ${list.data.pages[0].total}`
                    : ""}{" "}
                  · {rep?.name ?? "Everyone"}
                  {list.hasNextPage ? " · more available" : ""}
                </p>
                {showFilters && (
                  <div className="flex flex-wrap gap-4 border-t border-by-border-engraved pt-4">
                    <label className="text-xs">
                      Behavior family
                      <select
                        aria-label="Behavior family"
                        value={family}
                        onChange={(event) => setFamily(event.target.value)}
                        className="ml-2 max-w-60 rounded-md border border-by-border-control bg-white p-2"
                      >
                        <option value="all">All</option>
                        {Object.entries(BEHAVIOR_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      Loaded CRM stages
                      <select
                        aria-label="CRM stage"
                        value={stage}
                        onChange={(event) => setStage(event.target.value)}
                        className="ml-2 rounded-md border border-by-border-control bg-white p-2"
                      >
                        <option value="all">All</option>
                        {[
                          ...new Set(calls.map((c) => c.dealStage).filter((s): s is string => !!s)),
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setText("");
                        setFamily("all");
                        setStage("all");
                        setAnalysisFilter("all");
                        setDays(0);
                      }}
                      className="text-xs underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </section>
              {list.isError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700"
                >
                  Calls could not load completely.{" "}
                  <button type="button" className="underline" onClick={() => void list.refetch()}>
                    Retry
                  </button>
                </p>
              )}
              {list.isPending ? (
                <p role="status" className="rounded-xl bg-white p-8 text-sm">
                  Loading calls…
                </p>
              ) : !calls.length && !list.error ? (
                <section className="rounded-xl border border-by-border-engraved bg-white p-8">
                  <h2 className="text-xl">No calls yet</h2>
                  <p className="mt-3 text-sm leading-6 text-by-text-secondary">
                    Connect your recorder or upload a recording. Each analyzed conversation gets a
                    review with source evidence and a suggested next step.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="mt-5 rounded-md bg-by-surface-control-dark px-4 py-2.5 text-sm text-white"
                  >
                    Upload a recording
                  </button>
                </section>
              ) : (
                <CallList
                  calls={visible}
                  selectedId={null}
                  onSelect={(id) =>
                    update({
                      callId: id,
                      tab: "summary",
                      runId: undefined,
                      turnId: undefined,
                      eventId: undefined,
                      at: undefined,
                    })
                  }
                  search={text}
                  onSearch={setText}
                />
              )}
              {list.hasNextPage && (
                <button
                  type="button"
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                  className="rounded-md border border-by-border-control bg-white px-4 py-2 text-sm disabled:opacity-40"
                >
                  {list.isFetchingNextPage ? "Loading…" : "Load more calls"}
                </button>
              )}
              <p className="text-[11px] text-by-text-tertiary">
                Search, behavior and status filters apply to loaded calls. CRM stages describe the
                CRM record, not a verified outcome of an individual call.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
function SourceUnavailable({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-amber-300 bg-white p-8">
      <h2 className="text-lg">Source unavailable</h2>
      <p className="mt-3 text-sm leading-6 text-by-text-secondary">
        {message} Another call has not been substituted.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-md border border-by-border-control px-4 py-2 text-sm"
      >
        Return to calls
      </button>
    </section>
  );
}
