/* eslint-disable @typescript-eslint/no-explicit-any -- call intelligence tables are not yet present in the generated Supabase client types */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  PhoneCall,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { syncGoHighLevel, writeCallToGoHighLevel } from "@/lib/queries";

export const Route = createFileRoute("/app/crm/calls")({ component: CallsPage });
const db = supabase as any;

type WritebackField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  evidence_quote: string;
  crm_target: string;
  eligible: boolean;
  reason: string;
};
type CallInsight = {
  id: string;
  summary: string | null;
  sales_profile: string | null;
  vertical_insights: Record<string, any> | null;
  crm_writeback_preview: WritebackField[] | null;
  missing_required_fields: string[] | null;
  writeback_status: string | null;
};
type LiveCall = {
  id: string;
  contact_id: string | null;
  lead_id: string | null;
  provider: string | null;
  direction: string;
  status: string;
  duration: number | null;
  disposition: string | null;
  started_at: string | null;
  created_at: string;
  contactName: string;
  company: string;
  dealName: string | null;
  transcript: string | null;
  segments: unknown[];
  insight: CallInsight | null;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function formatWhen(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
function segmentLines(call: LiveCall) {
  const parsed = call.segments
    .map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const text = String(item.transcript ?? item.text ?? "").trim();
      if (!text) return null;
      const seconds = Number(item.startTime ?? item.start_time ?? 0);
      const channel = String(item.speaker ?? item.mediaChannel ?? item.channel ?? "Call");
      return {
        key: `${index}-${seconds}`,
        time: formatDuration(Number.isFinite(seconds) ? Math.round(seconds) : 0),
        speaker: channel === "1" ? "Agent" : channel === "2" ? "Contact" : channel,
        text,
      };
    })
    .filter(Boolean) as Array<{ key: string; time: string; speaker: string; text: string }>;
  return parsed.length
    ? parsed
    : call.transcript
      ? [{ key: call.id, time: "0:00", speaker: "Call", text: call.transcript }]
      : [];
}

function CallsPage() {
  const { currentOrgId } = useAuth();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tab, setTab] = useState<"summary" | "transcript">("summary");

  const load = useCallback(async () => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: callRows, error } = await db
        .from("calls")
        .select(
          "id,contact_id,lead_id,provider,direction,status,duration,disposition,started_at,created_at",
        )
        .eq("organization_id", currentOrgId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rawCalls = callRows ?? [];
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
          ? db.from("leads").select("id,name").eq("organization_id", currentOrgId).in("id", leadIds)
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
              .select(
                "id,call_id,summary,sales_profile,vertical_insights,crm_writeback_preview,missing_required_fields,writeback_status",
              )
              .eq("organization_id", currentOrgId)
              .in("call_id", callIds)
          : Promise.resolve({ data: [] }),
      ]);
      const contacts = new Map((contactsResult.data ?? []).map((row: any) => [row.id, row]));
      const leads = new Map((leadsResult.data ?? []).map((row: any) => [row.id, row]));
      const transcripts = new Map(
        (transcriptsResult.data ?? []).map((row: any) => [row.call_id, row]),
      );
      const insights = new Map((insightsResult.data ?? []).map((row: any) => [row.call_id, row]));
      const hydrated: LiveCall[] = rawCalls.map((call: any) => {
        const contact: any = contacts.get(call.contact_id);
        const lead: any = leads.get(call.lead_id);
        const transcript: any = transcripts.get(call.id);
        return {
          ...call,
          contactName:
            [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
            "Unmatched contact",
          company: contact?.company || "No company",
          dealName: lead?.name || null,
          transcript: transcript?.transcript_text || null,
          segments: Array.isArray(transcript?.speaker_segments) ? transcript.speaker_segments : [],
          insight: (insights.get(call.id) as CallInsight) ?? null,
        };
      });
      setCalls(hydrated);
      setSelectedId((current) =>
        current && hydrated.some((call) => call.id === current)
          ? current
          : (hydrated[0]?.id ?? null),
      );
    } catch (error) {
      toast.error("Could not load call data", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    void load();
  }, [load]);
  const selected = calls.find((call) => call.id === selectedId) ?? null;
  const transcript = useMemo(() => (selected ? segmentLines(selected) : []), [selected]);
  const fields = selected?.insight?.crm_writeback_preview ?? [];
  const eligibleFields = fields.filter((field) => field.eligible);
  const dealInsights = selected?.insight?.vertical_insights?.deal_insights ?? {};

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await syncGoHighLevel();
      toast.success(
        `Imported ${result.calls_imported} calls and ${result.transcripts_imported} transcripts`,
      );
      if (result.conversation_warning) toast.warning(result.conversation_warning);
      await load();
    } catch (error) {
      toast.error("GoHighLevel sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };
  const approve = async () => {
    if (!selected?.insight?.id) return;
    setWriting(true);
    try {
      await writeCallToGoHighLevel(selected.insight.id);
      toast.success("Approved fields were written to GoHighLevel");
      await load();
    } catch (error) {
      toast.error("CRM write-back failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#eeefeb]">
      <div className="mx-auto max-w-[1460px] p-3 sm:p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b818a]">
              Live conversation workspace
            </div>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">
              Calls captured from your CRM.
            </h1>
            <p className="mt-1 text-[12px] text-[#747a83]">
              Organization-wide call records, transcripts, AI insights, and controlled CRM
              write-back.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-full border border-black/[0.1] bg-[#f8f8f5] px-4 text-[11px] font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={sync}
              disabled={syncing}
              className="flex h-10 items-center gap-2 rounded-full bg-[#111318] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              <PhoneCall className="h-3.5 w-3.5" /> {syncing ? "Syncing…" : "Sync GoHighLevel"}
            </button>
          </div>
        </div>
        {!loading && calls.length === 0 ? (
          <section className="rounded-[24px] border border-black/[0.09] bg-[#f8f8f5] px-6 py-16 text-center">
            <PhoneCall className="mx-auto h-8 w-8 text-[#3275d8]" />
            <h2 className="mt-4 text-lg font-bold">No real calls have been imported yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-[#747a83]">
              Connect a CRM with conversation access, then sync. Bylda does not display sample calls
              in this workspace.
            </p>
            <Link
              to="/app/integrations"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111318] px-4 py-2.5 text-[11px] font-semibold text-white"
            >
              Manage integrations <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[20px] border border-black/[0.09] bg-[#f8f8f5] xl:sticky xl:top-0 xl:max-h-[calc(100vh-145px)]">
              <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-4">
                <span className="text-[12px] font-bold">Recent calls</span>
                <span className="rounded-full bg-[#e7e8e4] px-2 py-1 text-[9px] font-semibold text-[#777d85]">
                  {calls.length} loaded
                </span>
              </div>
              <div className="max-h-[calc(100vh-205px)] overflow-y-auto p-2">
                {calls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedId(call.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${call.id === selectedId ? "bg-[#e5ebf5]" : "hover:bg-black/[0.03]"}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbe7f8] text-[10px] font-bold text-[#346dbf]">
                      {initials(call.contactName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-bold">
                        {call.contactName}
                      </span>
                      <span className="block truncate text-[9px] text-[#7b818a]">
                        {call.company} · {formatWhen(call.started_at ?? call.created_at)}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-[#3275d8]">
                        {call.provider ?? "unknown"} · {formatDuration(call.duration)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>
            {selected && (
              <main className="min-w-0 space-y-4">
                <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5]">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dbe7f8] text-[12px] font-bold text-[#346dbf]">
                        {initials(selected.contactName)}
                      </span>
                      <div>
                        <h2 className="text-[20px] font-bold tracking-[-0.03em]">
                          {selected.contactName}
                        </h2>
                        <div className="mt-1 text-[11px] text-[#777d86]">
                          {selected.dealName ?? selected.company} · {selected.direction} ·{" "}
                          {formatWhen(selected.started_at ?? selected.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#737982]">
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDuration(selected.duration)}
                      </span>
                      <span className="rounded-full bg-[#dff1e7] px-2 py-1 font-bold uppercase text-[#28764d]">
                        {selected.status}
                      </span>
                      <span className="rounded bg-[#e4ebf7] px-2 py-1 font-bold uppercase text-[#346dbf]">
                        {selected.provider ?? "unknown"}
                      </span>
                    </div>
                  </div>
                </section>
                <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(390px,0.9fr)]">
                  <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5]">
                    <div className="flex items-center justify-between border-b border-black/[0.08] px-5">
                      <div className="flex h-[58px] items-end gap-6">
                        {(["summary", "transcript"] as const).map((item) => (
                          <button
                            key={item}
                            onClick={() => setTab(item)}
                            className={`h-full border-b-2 text-[11px] font-semibold capitalize ${tab === item ? "border-[#3275d8] text-[#1e5faf]" : "border-transparent text-[#7d838c]"}`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <Sparkles className="h-4 w-4 text-[#3275d8]" />
                    </div>
                    {tab === "summary" ? (
                      <div className="p-5 sm:p-6">
                        <div className="rounded-2xl bg-[#e9eef6] p-5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4774b5]">
                            Bylda’s read
                          </div>
                          <p className="mt-3 text-[14px] font-medium leading-7 text-[#333943]">
                            {selected.insight?.summary ??
                              (selected.transcript
                                ? "AI analysis is pending for this transcript."
                                : "No transcript was provided by the connected CRM for this call.")}
                          </p>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <Insight
                            title="Why this advances"
                            body={dealInsights.qualification_reason}
                          />
                          <Insight title="Primary risk" body={dealInsights.primary_risk} />
                          <Insight title="Primary driver" body={dealInsights.primary_driver} />
                          <Insight title="Rep coaching" body={dealInsights.coaching_note} />
                        </div>
                      </div>
                    ) : transcript.length ? (
                      <div className="divide-y divide-black/[0.07]">
                        {transcript.map((line) => (
                          <div
                            key={line.key}
                            className="grid grid-cols-[50px_70px_1fr] gap-3 px-5 py-5 text-[12px] leading-6"
                          >
                            <span className="font-mono text-[9px] text-[#969ba2]">{line.time}</span>
                            <span className="font-semibold text-[#474d55]">{line.speaker}</span>
                            <p className="whitespace-pre-wrap text-[#626871]">{line.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel
                        icon={<FileText className="h-5 w-5" />}
                        text="This CRM call does not have an accessible transcript."
                      />
                    )}
                  </section>
                  <section className="overflow-hidden rounded-[22px] border border-black/[0.09] bg-[#f8f8f5] 2xl:sticky 2xl:top-4">
                    <div className="border-b border-black/[0.08] p-5">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#3275d8]" />
                        <h2 className="text-[14px] font-bold">CRM write-back</h2>
                      </div>
                      <p className="mt-1 text-[10px] text-[#838890]">
                        Only evidence-backed fields marked eligible can be written.
                      </p>
                    </div>
                    {fields.length ? (
                      <div className="divide-y divide-black/[0.07]">
                        {fields.map((field) => (
                          <div key={field.key} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-bold">{field.label}</div>
                                <div className="mt-1 text-[12px] text-[#4f5660]">{field.value}</div>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-[8px] font-bold ${field.eligible ? "bg-[#dff1e7] text-[#28764d]" : "bg-[#ececea] text-[#777d85]"}`}
                              >
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                            {field.evidence_quote && (
                              <p className="mt-2 text-[9px] italic text-[#8a9098]">
                                “{field.evidence_quote}”
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel
                        icon={<Database className="h-5 w-5" />}
                        text="No approved CRM fields were extracted from this call."
                      />
                    )}
                    <div className="border-t border-black/[0.08] p-4">
                      {selected.insight?.writeback_status === "written" ? (
                        <div className="flex items-center justify-center gap-2 rounded-full bg-[#dff1e7] px-4 py-3 text-[10px] font-bold text-[#28764d]">
                          <CheckCircle2 className="h-4 w-4" /> Written to GoHighLevel
                        </div>
                      ) : (
                        <button
                          onClick={approve}
                          disabled={
                            !eligibleFields.length ||
                            !selected.insight ||
                            selected.provider !== "gohighlevel" ||
                            writing
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111318] px-4 py-3 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {writing
                            ? "Writing…"
                            : `Approve ${eligibleFields.length} fields and write to CRM`}
                        </button>
                      )}
                      <p className="mt-2 text-center text-[9px] text-[#8b9097]">
                        Write-back requires explicit approval and a linked GoHighLevel contact.
                      </p>
                    </div>
                  </section>
                </div>
              </main>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Insight({ title, body }: { title: string; body?: string }) {
  return (
    <article className="rounded-2xl border border-black/[0.08] bg-white p-4">
      <h3 className="text-[11px] font-bold">{title}</h3>
      <p className="mt-2 text-[11px] leading-5 text-[#6d737b]">
        {body || "Not identified in this call."}
      </p>
    </article>
  );
}
function EmptyPanel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-[#858a92]">
      {icon}
      <p className="mt-3 max-w-sm text-[11px] leading-5">{text}</p>
    </div>
  );
}
