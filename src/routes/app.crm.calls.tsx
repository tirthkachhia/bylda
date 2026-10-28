/* eslint-disable @typescript-eslint/no-explicit-any -- call intelligence tables are not yet present in the generated Supabase client types */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, PhoneCall, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  assignRepPlaybook,
  deleteCall,
  playbooksQuery,
  repsQuery,
  rescoreCall,
} from "@/lib/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CallInsight, CoachingCall } from "@/lib/coaching/calls";
import { RepPicker } from "@/components/app/coaching/RepPicker";
import { BulkCallUpload } from "@/components/app/coaching/BulkCallUpload";
import { CallList } from "@/components/app/coaching/CallList";
import { CallDetail, type DetailTab } from "@/components/app/coaching/CallDetail";
import { PlaybooksPanel } from "@/components/app/coaching/PlaybooksPanel";
import { RepReportPanel } from "@/components/app/coaching/RepReportPanel";

export const Route = createFileRoute("/app/crm/calls")({ component: CallsPage });
const db = supabase as any;

type PageView = "calls" | "report" | "playbooks";

function CallsPage() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const repsQ = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const playbooksQ = useQuery({ ...playbooksQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const playbooks = playbooksQ.data ?? [];
  const [repId, setRepId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CoachingCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [showUpload, setShowUpload] = useState(false);
  const [view, setView] = useState<PageView>("calls");

  const rep = repsQ.data?.find((item) => item.id === repId) ?? null;

  const load = useCallback(
    async (forRep: string | null, includeCallId?: string | null) => {
      if (!currentOrgId || !forRep) {
        setCalls([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const { data: callRows, error } = await db
          .from("calls")
          .select(
            "id,rep_id,contact_id,lead_id,provider,direction,status,duration,disposition,started_at,created_at,metadata",
          )
          .eq("organization_id", currentOrgId)
          .eq("rep_id", forRep)
          .order("created_at", { ascending: false })
          .order("started_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (error) throw error;
        const rawCalls = callRows ?? [];
        if (includeCallId && !rawCalls.some((c: any) => c.id === includeCallId)) {
          const { data: citedCall, error: citedError } = await db
            .from("calls")
            .select(
              "id,rep_id,contact_id,lead_id,provider,direction,status,duration,disposition,started_at,created_at,metadata",
            )
            .eq("organization_id", currentOrgId)
            .eq("rep_id", forRep)
            .eq("id", includeCallId)
            .maybeSingle();
          if (citedError || !citedCall)
            throw new Error(
              "The cited call is unavailable for this rep. No other recording was opened.",
            );
          rawCalls.unshift(citedCall);
        }
        const callIds = rawCalls.map((call: any) => call.id);
        const contactIds = rawCalls.map((call: any) => call.contact_id).filter(Boolean);
        const leadIds = rawCalls.map((call: any) => call.lead_id).filter(Boolean);
        const [contactsResult, leadsResult, transcriptsResult, insightsResult] = await Promise.all([
          contactIds.length
            ? db
                .from("contacts")
                .select("id,first_name,last_name,company")
                .eq("org_id", currentOrgId)
                .in("id", contactIds)
            : Promise.resolve({ data: [] }),
          leadIds.length
            ? db
                .from("leads")
                .select("id,name")
                .eq("organization_id", currentOrgId)
                .in("id", leadIds)
            : Promise.resolve({ data: [] }),
          callIds.length
            ? db
                .from("call_transcripts")
                .select("call_id,transcript_text,speaker_segments")
                .eq("organization_id", currentOrgId)
                .in("call_id", callIds)
            : Promise.resolve({ data: [] }),
          callIds.length
            ? db
                .from("call_insights")
                .select("id,call_id,summary,sales_profile,vertical_insights")
                .eq("organization_id", currentOrgId)
                .in("call_id", callIds)
            : Promise.resolve({ data: [] }),
        ]);
        for (const result of [contactsResult, leadsResult, transcriptsResult, insightsResult]) {
          if (result.error) throw result.error;
        }
        const contacts = new Map((contactsResult.data ?? []).map((row: any) => [row.id, row]));
        const leads = new Map((leadsResult.data ?? []).map((row: any) => [row.id, row]));
        const transcripts = new Map(
          (transcriptsResult.data ?? []).map((row: any) => [row.call_id, row]),
        );
        const insights = new Map((insightsResult.data ?? []).map((row: any) => [row.call_id, row]));
        const hydrated: CoachingCall[] = rawCalls.map((call: any) => {
          const contact: any = contacts.get(call.contact_id);
          const lead: any = leads.get(call.lead_id);
          const transcript: any = transcripts.get(call.id);
          const { metadata, ...callRow } = call;
          return {
            ...callRow,
            coaching_stage:
              typeof metadata?.coaching_stage === "string" ? metadata.coaching_stage : null,
            coaching_error:
              typeof metadata?.coaching_error === "string" ? metadata.coaching_error : null,
            audio_path: typeof metadata?.audio_path === "string" ? metadata.audio_path : null,
            contactName:
              [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
              "Uploaded recording",
            company: contact?.company || "No company",
            dealName: lead?.name || null,
            transcript: transcript?.transcript_text || null,
            segments: Array.isArray(transcript?.speaker_segments)
              ? transcript.speaker_segments
              : [],
            insight: (insights.get(call.id) as CallInsight) ?? null,
          };
        });
        setCalls(hydrated);
        setSelectedId((current) =>
          current && hydrated.some((call) => call.id === current)
            ? current
            : (hydrated[0]?.id ?? null),
        );
        return true;
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Could not load call data. Please retry.",
        );
        toast.error("Could not load call data", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [currentOrgId],
  );

  useEffect(() => {
    setSeekSeconds(null);
    setSelectedId(null);
    void load(repId);
  }, [load, repId]);

  // While the transcriber worker is still processing any call, refresh every 10s so
  // rows move from "Transcribing…" to "Reviewed" without a manual reload.
  const inFlight = calls.some(
    (call) =>
      call.coaching_stage === "queued" ||
      call.coaching_stage === "transcribing" ||
      call.coaching_stage === "scoring" ||
      call.coaching_stage === "analyzing",
  );
  useEffect(() => {
    if (!inFlight || !repId) return;
    const timer = setInterval(() => void load(repId, selectedId), 10_000);
    return () => clearInterval(timer);
  }, [inFlight, repId, selectedId, load]);

  const visibleCalls = useMemo(
    () =>
      calls.filter((call) =>
        `${call.contactName} ${call.company} ${call.dealName ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
      ),
    [calls, search],
  );
  const selected = calls.find((call) => call.id === selectedId) ?? visibleCalls[0] ?? null;
  const reviewed = calls.filter((call) => call.insight).length;

  async function changePlaybook(value: string) {
    if (!rep) return;
    try {
      await assignRepPlaybook(rep.id, value === "__none__" ? null : value);
      await qc.invalidateQueries({ queryKey: ["reps", currentOrgId] });
      toast.success("Playbook updated. Re-analyze a call to apply it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign playbook");
    }
  }

  // Re-score with Jev, then re-analyze with Claude; the worker does both and the
  // 10-second poll picks up the stage changes (scoring → transcribed → reviewed).
  async function reanalyze(callId: string) {
    await rescoreCall(callId);
    await load(repId, selectedId);
  }

  // Delete the call row (transcript, scores, moments, and insights cascade) and
  // then the recording. The list updates locally; no reload needed.
  async function removeCall(callId: string) {
    const call = calls.find((item) => item.id === callId);
    const { audioRemoved } = await deleteCall(callId, call?.audio_path ?? null);
    setCalls((current) => current.filter((item) => item.id !== callId));
    if (selectedId === callId) setSelectedId(null);
    if (call?.audio_path && !audioRemoved)
      toast.warning("Call deleted, but its audio file could not be removed from storage.");
    else toast.success("Call deleted");
  }

  // The analyzer's fallback: with exactly one active playbook, unassigned reps use it.
  const fallbackLabel =
    playbooks.length === 1 ? `Default (${playbooks[0].name})` : "None (no playbook)";

  if (!currentOrgId || !user) return null;

  return (
    <div className="min-h-full bg-by-surface-canvas text-by-text-primary">
      <div className="mx-auto max-w-[1460px] p-3 sm:p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-by-text-secondary">
              Coaching
            </div>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">
              Calls &amp; coaching
            </h1>
            <p className="mt-1 text-[12px] text-by-text-secondary">
              {view === "calls"
                ? "Upload a rep’s recordings and review what was said, call by call."
                : view === "report"
                  ? "One page per rep: what to coach, the moments to play back, the lines to practice."
                  : "Write the sales process your reps are coached against, and keep every version."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div
              role="tablist"
              aria-label="Page view"
              className="flex h-10 items-center rounded-full border border-black/[0.1] bg-by-surface-raised p-1 text-[11px] font-semibold"
            >
              {(
                [
                  { key: "calls", label: "Calls", Icon: PhoneCall },
                  { key: "report", label: "Report", Icon: FileText },
                  { key: "playbooks", label: "Playbooks", Icon: BookOpen },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 ${view === key ? "bg-by-surface-control-dark text-white" : "text-by-text-secondary hover:text-by-text-primary"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            {view !== "playbooks" && (
              <div className="w-64">
                <RepPicker
                  organizationId={currentOrgId}
                  userId={user.id}
                  value={repId}
                  onChange={(id) => {
                    setRepId(id);
                    setSelectedId(null);
                    setSearch("");
                  }}
                />
              </div>
            )}
            {view === "calls" && (
              <>
                <button
                  onClick={() => void load(repId, selectedId)}
                  disabled={loading || !repId}
                  className="flex h-10 items-center gap-2 rounded-full border border-black/[0.1] bg-by-surface-raised px-4 text-[11px] font-semibold disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button
                  onClick={() => setShowUpload((value) => !value)}
                  disabled={!repId}
                  className="flex h-10 items-center gap-2 rounded-full bg-by-surface-control-dark px-4 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />{" "}
                  {showUpload ? "Hide upload" : "Upload recordings"}
                </button>
              </>
            )}
          </div>
        </div>

        {view === "playbooks" ? (
          <section className="rounded-by-card border border-black/[0.09] bg-by-surface-raised p-5 sm:p-6">
            <PlaybooksPanel />
          </section>
        ) : view === "report" ? (
          rep ? (
            <RepReportPanel
              repId={rep.id}
              repName={rep.name}
              onOpenCall={async (callId, seconds) => {
                if (!calls.some((c) => c.id === callId) && !(await load(repId, callId))) return;
                setSearch("");
                setSeekSeconds(seconds ?? null);
                setSelectedId(callId);
                setTab(seconds === undefined || seconds === null ? "summary" : "transcript");
                setView("calls");
              }}
            />
          ) : (
            <section className="rounded-by-card border border-black/[0.09] bg-by-surface-raised p-8 text-center text-sm text-by-text-secondary">
              Pick a rep to see or generate their report.
            </section>
          )
        ) : (
          <>
            {rep && showUpload && (
              <div className="mb-5">
                <BulkCallUpload
                  organizationId={currentOrgId}
                  userId={user.id}
                  repId={rep.id}
                  repName={rep.name}
                  onImported={() => {
                    setSearch("");
                    void load(rep.id);
                  }}
                />
              </div>
            )}

            {rep && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-by-text-secondary">
                <p>
                  <span className="font-semibold text-by-text-primary">{rep.name}</span> ·{" "}
                  {calls.length} {calls.length === 1 ? "call" : "calls"} · {reviewed} analyzed
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Playbook
                  </span>
                  <Select
                    value={rep.playbook_id ?? "__none__"}
                    onValueChange={(v) => void changePlaybook(v)}
                  >
                    <SelectTrigger
                      aria-label="Rep playbook"
                      className="h-9 w-64 rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 text-[12px] font-semibold text-by-text-primary shadow-none focus:ring-2 focus:ring-by-focus-ring focus:ring-offset-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-by-menu border-by-border-engraved bg-by-surface-raised text-by-text-primary shadow-by-float">
                      <SelectItem
                        value="__none__"
                        className="rounded-by-control text-[12px] focus:bg-by-surface-hover"
                      >
                        {fallbackLabel}
                      </SelectItem>
                      {playbooks.map((playbook) => (
                        <SelectItem
                          key={playbook.id}
                          value={playbook.id}
                          className="rounded-by-control text-[12px] focus:bg-by-surface-hover"
                        >
                          {playbook.name} · v{playbook.current?.version ?? "–"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setView("playbooks")}
                    className="text-[11px] font-semibold text-[#1e5faf] underline-offset-2 hover:underline"
                  >
                    Manage
                  </button>
                </div>
              </div>
            )}

            {loadError && (
              <div
                role="alert"
                className="mb-4 rounded-by-card border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                Could not load this rep’s calls. {loadError}{" "}
                <button
                  onClick={() => void load(repId, selectedId)}
                  className="ml-2 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!rep ? (
              <section className="rounded-by-card border border-black/[0.09] bg-by-surface-raised px-6 py-16 text-center">
                <PhoneCall className="mx-auto h-8 w-8 text-[#3275d8]" />
                <h2 className="mt-4 text-lg font-bold">Choose a rep to get started</h2>
                <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-by-text-secondary">
                  Pick an existing rep above, or add a new one, then upload their call recordings.
                </p>
              </section>
            ) : loading && calls.length === 0 ? (
              <div
                role="status"
                className="rounded-by-card border border-black/10 bg-white p-12 text-center text-sm text-slate-500"
              >
                Loading calls…
              </div>
            ) : !loadError && calls.length === 0 ? (
              <section className="rounded-by-card border border-black/[0.09] bg-by-surface-raised px-6 py-16 text-center">
                <PhoneCall className="mx-auto h-8 w-8 text-[#3275d8]" />
                <h2 className="mt-4 text-lg font-bold">No recordings yet for {rep.name}</h2>
                <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-by-text-secondary">
                  Upload this rep’s call recordings to get transcripts and coaching notes.
                </p>
                {!showUpload && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-by-surface-control-dark px-4 py-2.5 text-[11px] font-semibold text-white"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload recordings
                  </button>
                )}
              </section>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
                <CallList
                  calls={visibleCalls}
                  selectedId={selected?.id ?? null}
                  onSelect={(id) => {
                    setSeekSeconds(null);
                    setSelectedId(id);
                  }}
                  search={search}
                  onSearch={setSearch}
                />
                {selected && (
                  <CallDetail
                    key={selected.id}
                    call={selected}
                    seekSeconds={seekSeconds}
                    tab={tab}
                    onTab={setTab}
                    onReanalyze={reanalyze}
                    onDelete={removeCall}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
