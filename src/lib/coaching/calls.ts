import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { guestStore } from "@/lib/guest";
const isGuest = () => guestStore.get().isGuest;
import { validSourceSeconds } from "./source-navigation";

/** Insight row for one call, as read by the coaching page. */
export type CallInsight = {
  id: string;
  summary: string | null;
  sales_profile: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vertical_insights: Record<string, any> | null;
};

/** A call row hydrated with its contact, deal, transcript, and insight. */
export type CoachingCall = {
  id: string;
  rep_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  provider: string | null;
  direction: string;
  status: string;
  duration: number | null;
  disposition: string | null;
  started_at: string | null;
  created_at: string;
  /** From calls.metadata.coaching_stage: queued | transcribing | transcribed | failed, or null. */
  coaching_stage: string | null;
  coaching_error: string | null;
  /** From calls.metadata.audio_path: the recording in the call-audio bucket, if uploaded. */
  audio_path: string | null;
  recording_url?: string | null;
  repName?: string;
  dealStage?: string | null;
  dealValue?: number | null;
  contactName: string;
  company: string;
  dealName: string | null;
  transcript: string | null;
  segments: unknown[];
  insight: CallInsight | null;
};

export type TranscriptLine = {
  key: string;
  time: string;
  speaker: string;
  text: string;
  /** Present only for Gemini-transcribed calls. */
  tone?: { label: string; note: string };
  overlap?: boolean;
};

export function formatDuration(seconds: number | null) {
  if (!validSourceSeconds(seconds)) return "—";
  seconds = Math.floor(seconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatWhen(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Speaker segments as display lines; falls back to the raw transcript as one line. */
export function segmentLines(call: Pick<CoachingCall, "id" | "segments" | "transcript">) {
  const parsed = call.segments
    .map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const text = String(item.transcript ?? item.text ?? "").trim();
      if (!text) return null;
      const rawSeconds = item.startTime ?? item.start_time ?? item.start;
      const seconds =
        typeof rawSeconds === "number"
          ? rawSeconds
          : typeof rawSeconds === "string" && rawSeconds.trim()
            ? Number(rawSeconds)
            : NaN;
      const channel = String(item.speaker ?? item.mediaChannel ?? item.channel ?? "Call");
      const toneRaw = item.tone as { label?: unknown; note?: unknown } | undefined;
      const tone =
        toneRaw && typeof toneRaw.label === "string"
          ? { label: toneRaw.label, note: typeof toneRaw.note === "string" ? toneRaw.note : "" }
          : undefined;
      const line: TranscriptLine = {
        key: `${index}-${seconds}`,
        time: formatDuration(validSourceSeconds(seconds) ? Math.floor(seconds) : null),
        speaker: channel === "1" ? "Agent" : channel === "2" ? "Contact" : channel,
        text,
      };
      if (tone) line.tone = tone;
      if (item.overlap === true) line.overlap = true;
      return line;
    })
    .filter(Boolean) as TranscriptLine[];
  return parsed.length
    ? parsed
    : call.transcript
      ? [{ key: call.id, time: "—", speaker: "Call", text: call.transcript }]
      : [];
}

export type CallsScope = { organizationId: string; repId: string | null; since: string | null };
export type CoachingCallsPage = {
  calls: CoachingCall[];
  total: number | null;
  nextOffset: number | null;
};
// The generated database schema predates the coaching migrations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const CALL_SELECT =
  "id,rep_id,contact_id,lead_id,provider,direction,status,duration,disposition,started_at,created_at,metadata,recording_url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hydrateCalls(organizationId: string, rows: any[]): Promise<CoachingCall[]> {
  if (!rows.length) return [];
  const ids = rows.map((c) => c.id),
    contactIds = [...new Set(rows.map((c) => c.contact_id).filter(Boolean))],
    leadIds = [...new Set(rows.map((c) => c.lead_id).filter(Boolean))],
    repIds = [...new Set(rows.map((c) => c.rep_id).filter(Boolean))];
  const [contacts, leads, reps, transcripts, insights] = await Promise.all([
    contactIds.length
      ? db
          .from("contacts")
          .select("id,first_name,last_name,company")
          .eq("org_id", organizationId)
          .in("id", contactIds)
      : { data: [] },
    leadIds.length
      ? db
          .from("leads")
          .select("id,name,stage,value")
          .eq("organization_id", organizationId)
          .in("id", leadIds)
      : { data: [] },
    repIds.length
      ? db.from("reps").select("id,name").eq("organization_id", organizationId).in("id", repIds)
      : { data: [] },
    db
      .from("call_transcripts")
      .select("call_id,transcript_text,speaker_segments")
      .eq("organization_id", organizationId)
      .in("call_id", ids),
    db
      .from("call_insights")
      .select("id,call_id,summary,sales_profile,vertical_insights")
      .eq("organization_id", organizationId)
      .in("call_id", ids),
  ]);
  for (const result of [contacts, leads, reps, transcripts, insights])
    if (result.error) throw result.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type JoinedRow = Record<string, any>;
  const index = (data: JoinedRow[], key: string) =>
    new Map<string, JoinedRow>(data.map((row) => [row[key], row]));
  const c = index(contacts.data ?? [], "id"),
    l = index(leads.data ?? [], "id"),
    r = index(reps.data ?? [], "id"),
    t = index(transcripts.data ?? [], "call_id"),
    i = index(insights.data ?? [], "call_id");
  return rows.map(({ metadata, ...row }) => ({
    ...row,
    coaching_stage: typeof metadata?.coaching_stage === "string" ? metadata.coaching_stage : null,
    coaching_error: typeof metadata?.coaching_error === "string" ? metadata.coaching_error : null,
    audio_path: typeof metadata?.audio_path === "string" ? metadata.audio_path : null,
    contactName:
      [c.get(row.contact_id)?.first_name, c.get(row.contact_id)?.last_name]
        .filter(Boolean)
        .join(" ") ||
      c.get(row.contact_id)?.company ||
      "Uploaded recording",
    company: c.get(row.contact_id)?.company || "No company",
    repName: r.get(row.rep_id)?.name || "Unassigned rep",
    dealName: l.get(row.lead_id)?.name ?? null,
    dealStage: l.get(row.lead_id)?.stage ?? null,
    dealValue:
      typeof l.get(row.lead_id)?.value === "number" ? (l.get(row.lead_id)?.value ?? null) : null,
    transcript: t.get(row.id)?.transcript_text ?? null,
    segments: Array.isArray(t.get(row.id)?.speaker_segments)
      ? (t.get(row.id)?.speaker_segments ?? [])
      : [],
    insight: i.get(row.id) ?? null,
  }));
}

export async function loadCoachingCallsPage(
  scope: CallsScope,
  offset = 0,
): Promise<CoachingCallsPage> {
  if (!scope.organizationId || isGuest()) return { calls: [], total: 0, nextOffset: null };
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid call page.");
  let query = db
    .from("calls")
    .select(CALL_SELECT, { count: "exact" })
    .eq("organization_id", scope.organizationId);
  if (scope.repId) query = query.eq("rep_id", scope.repId);
  if (scope.since) {
    if (!Number.isFinite(Date.parse(scope.since))) throw new Error("Invalid call date range.");
    const since = new Date(scope.since).toISOString();
    query = query.or(`started_at.gte.${since},and(started_at.is.null,created_at.gte.${since})`);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 50);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Call data is unavailable.");
  return {
    calls: await hydrateCalls(scope.organizationId, data.slice(0, 50)),
    total: count ?? null,
    nextOffset: data.length > 50 ? offset + 50 : null,
  };
}

export const coachingCallQuery = (organizationId: string, callId: string | null) =>
  queryOptions({
    queryKey: ["coaching-call", organizationId, callId],
    enabled: !!organizationId && !!callId && !isGuest(),
    queryFn: async (): Promise<CoachingCall | null> => {
      if (!organizationId || !callId) throw new Error("A workspace and source call are required.");
      const { data, error } = await db
        .from("calls")
        .select(CALL_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", callId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (await hydrateCalls(organizationId, [data]))[0] ?? null;
    },
  });

/** Exact observed call counts for directory rows, without loading transcripts or grading reps. */
export const repCallCountsQuery = (organizationId: string, since: string) =>
  queryOptions({
    queryKey: ["figma-rep-call-counts", organizationId, since],
    enabled: !!organizationId && !isGuest(),
    queryFn: async (): Promise<Record<string, number>> => {
      if (!Number.isFinite(Date.parse(since))) throw new Error("Invalid call date range.");
      const counts: Record<string, number> = {};
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("calls")
          .select("id,rep_id")
          .eq("organization_id", organizationId)
          .or(`started_at.gte.${since},and(started_at.is.null,created_at.gte.${since})`)
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Call counts unavailable.");
        for (const row of data)
          if (typeof row.rep_id === "string") counts[row.rep_id] = (counts[row.rep_id] ?? 0) + 1;
        if (data.length < 500) return counts;
      }
    },
  });
