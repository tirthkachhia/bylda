import { getCallIngestUrl } from "@/lib/queries";
import { analyzeCall } from "@/lib/crm";
import { untyped, unwrap } from "../core/db";
import { NotBuiltError } from "../core/errors";
import type { CallAnalysisJobRow, CallInsightRow, CallRow, CallTranscriptRow } from "../db-types";
import type { CallFilter } from "../types";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
};
type LeadRow = { id: string; name: string | null };
type ProfileRow = { id: string; full_name: string | null };

export type CallRowBundle = {
  call: CallRow;
  contact: ContactRow | null;
  lead: LeadRow | null;
  rep: ProfileRow | null;
  job: CallAnalysisJobRow | null;
  insight: CallInsightRow | null;
};

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

/** calls + contact/lead names + latest analysis job + insight — org-scoped (RLS: is_org_member). */
export async function fetchCallRows(orgId: string, f: CallFilter): Promise<CallRowBundle[]> {
  let q = untyped().from("calls").select("*").eq("organization_id", orgId);
  if (f.repId) q = q.eq("user_id", f.repId);
  if (f.from) q = q.gte("started_at", f.from);
  const calls =
    unwrap<CallRow[]>(await q.order("started_at", { ascending: false }).limit(f.limit ?? 100)) ??
    [];
  if (calls.length === 0) return [];
  const ids = calls.map((c) => c.id);
  const contactIds = calls.map((c) => c.contact_id).filter(Boolean) as string[];
  const leadIds = calls.map((c) => c.lead_id).filter(Boolean) as string[];
  const repIds = [...new Set(calls.map((c) => c.user_id).filter(Boolean) as string[])];
  const [contacts, leads, jobs, insights, reps] = await Promise.all([
    contactIds.length
      ? untyped().from("contacts").select("id,first_name,last_name,company").in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    leadIds.length
      ? untyped().from("leads").select("id,name").in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
    untyped()
      .from("call_analysis_jobs")
      .select("*")
      .in("call_id", ids)
      .order("created_at", { ascending: false }),
    untyped().from("call_insights").select("*").in("call_id", ids),
    repIds.length
      ? untyped().from("profiles").select("id,full_name").in("id", repIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const r = byId(unwrap<ProfileRow[]>(reps) ?? []);
  const c = byId(unwrap<ContactRow[]>(contacts) ?? []);
  const l = byId(unwrap<LeadRow[]>(leads) ?? []);
  const jobByCall = new Map<string, CallAnalysisJobRow>();
  for (const j of unwrap<CallAnalysisJobRow[]>(jobs) ?? [])
    if (!jobByCall.has(j.call_id)) jobByCall.set(j.call_id, j);
  const insByCall = new Map((unwrap<CallInsightRow[]>(insights) ?? []).map((i) => [i.call_id, i]));
  return calls.map((call) => ({
    call,
    contact: call.contact_id ? (c.get(call.contact_id) ?? null) : null,
    lead: call.lead_id ? (l.get(call.lead_id) ?? null) : null,
    rep: call.user_id ? (r.get(call.user_id) ?? null) : null,
    job: jobByCall.get(call.id) ?? null,
    insight: insByCall.get(call.id) ?? null,
  }));
}

export async function fetchCallBundle(
  orgId: string,
  callId: string,
): Promise<(CallRowBundle & { transcript: CallTranscriptRow | null }) | null> {
  const call = unwrap<CallRow | null>(
    await untyped()
      .from("calls")
      .select("*")
      .eq("organization_id", orgId)
      .eq("id", callId)
      .maybeSingle(),
  );
  if (!call) return null;
  const [contact, lead, job, insight, transcript, rep] = await Promise.all([
    call.contact_id
      ? untyped()
          .from("contacts")
          .select("id,first_name,last_name,company")
          .eq("id", call.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    call.lead_id
      ? untyped().from("leads").select("id,name").eq("id", call.lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    untyped()
      .from("call_analysis_jobs")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    untyped().from("call_insights").select("*").eq("call_id", callId).maybeSingle(),
    untyped().from("call_transcripts").select("*").eq("call_id", callId).maybeSingle(),
    call.user_id
      ? untyped().from("profiles").select("id,full_name").eq("id", call.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    call,
    contact: unwrap<ContactRow | null>(contact),
    lead: unwrap<LeadRow | null>(lead),
    rep: unwrap<ProfileRow | null>(rep),
    job: unwrap<CallAnalysisJobRow | null>(job),
    insight: unwrap<CallInsightRow | null>(insight),
    transcript: unwrap<CallTranscriptRow | null>(transcript),
  };
}

/** Re-run analysis — existing wrapper (src/lib/crm.ts → analyze-call edge fn). */
export const reanalyze = (callId: string) => analyzeCall(callId);

/** Manual upload URL — existing wrapper (src/lib/queries.ts → get-call-ingest-url). */
export const uploadUrl = (orgId: string) => getCallIngestUrl(orgId);

// ── MISSING — real fetchers throw until the backend lands (BACKEND_BACKLOG.md) ──
/** C-05 · calls V1 columns (coaching_value, stage_at_call, …) */
export async function fetchCallsV1(): Promise<never> {
  throw new NotBuiltError("calls.v1_columns");
}
/** C-24 · saved_views */
export async function fetchSavedViews(): Promise<never> {
  throw new NotBuiltError("saved_views");
}
