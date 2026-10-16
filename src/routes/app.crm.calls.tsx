/* eslint-disable @typescript-eslint/no-explicit-any -- call intelligence tables are not yet present in the generated Supabase client types */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { repsQuery } from "@/lib/queries";
import type { CallInsight, CoachingCall } from "@/lib/coaching/calls";
import { RepPicker } from "@/components/app/coaching/RepPicker";
import { BulkCallUpload } from "@/components/app/coaching/BulkCallUpload";
import { CallList } from "@/components/app/coaching/CallList";
import { CallDetail, type DetailTab } from "@/components/app/coaching/CallDetail";

export const Route = createFileRoute("/app/crm/calls")({ component: CallsPage });
const db = supabase as any;

function CallsPage() {
  const { currentOrgId, user } = useAuth();
  const repsQ = useQuery({ ...repsQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const [repId, setRepId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CoachingCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<DetailTab>("summary");
  const [showUpload, setShowUpload] = useState(false);

  const rep = repsQ.data?.find((item) => item.id === repId) ?? null;

  const load = useCallback(
    async (forRep: string | null) => {
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
            "id,rep_id,contact_id,lead_id,provider,direction,status,duration,disposition,started_at,created_at",
          )
          .eq("organization_id", currentOrgId)
          .eq("rep_id", forRep)
          .order("created_at", { ascending: false })
          .order("started_at", { ascending: false, nullsFirst: false })
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
          return {
            ...call,
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
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Could not load call data. Please retry.",
        );
        toast.error("Could not load call data", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setLoading(false);
      }
    },
    [currentOrgId],
  );

  useEffect(() => {
    void load(repId);
  }, [load, repId]);

  const visibleCalls = useMemo(
    () =>
      calls.filter((call) =>
        `${call.contactName} ${call.company} ${call.dealName ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
      ),
    [calls, search],
  );
  const selected = visibleCalls.find((call) => call.id === selectedId) ?? visibleCalls[0] ?? null;
  const reviewed = calls.filter((call) => call.insight).length;

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
              Upload a rep’s recordings and review what was said, call by call.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
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
            <button
              onClick={() => void load(repId)}
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
              <Upload className="h-3.5 w-3.5" /> {showUpload ? "Hide upload" : "Upload recordings"}
            </button>
          </div>
        </div>

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
          <p className="mb-4 text-[12px] text-by-text-secondary">
            <span className="font-semibold text-by-text-primary">{rep.name}</span> · {calls.length}{" "}
            {calls.length === 1 ? "call" : "calls"} · {reviewed} reviewed
          </p>
        )}

        {loadError && (
          <div
            role="alert"
            className="mb-4 rounded-by-card border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            Could not load this rep’s calls. {loadError}{" "}
            <button onClick={() => void load(repId)} className="ml-2 font-semibold underline">
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
              onSelect={setSelectedId}
              search={search}
              onSearch={setSearch}
            />
            {selected && <CallDetail call={selected} tab={tab} onTab={setTab} />}
          </div>
        )}
      </div>
    </div>
  );
}
