import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// Database types are generated after migrations are deployed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export type CallNote = {
  id: string;
  organization_id: string;
  call_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};
export type CoachingAssignment = {
  id: string;
  organization_id: string;
  rep_id: string;
  call_id: string | null;
  run_id: string | null;
  assigned_by: string | null;
  focus: string;
  note: string;
  check_in_at: string;
  status: "active" | "completed" | "cancelled";
  check_in_note: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
function checkedBody(body: string) {
  const text = body.trim();
  if (!text || text.length > 10000) throw new Error("Enter between 1 and 10,000 characters.");
  return text;
}
export const callNotesQuery = (organizationId: string, callId: string) =>
  queryOptions({
    queryKey: ["call-notes", organizationId, callId],
    enabled: !!organizationId && !!callId,
    queryFn: async (): Promise<CallNote[]> => {
      const notes: CallNote[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("coaching_call_notes")
          .select("id,organization_id,call_id,author_id,body,created_at,updated_at")
          .eq("organization_id", organizationId)
          .eq("call_id", callId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Notes could not be read.");
        notes.push(...data);
        if (data.length < 500) return notes;
      }
    },
  });
export async function saveCallNote(
  organizationId: string,
  callId: string,
  body: string,
  previous?: CallNote,
) {
  const text = checkedBody(body);
  const query = previous
    ? db
        .from("coaching_call_notes")
        .update({ body: text })
        .eq("id", previous.id)
        .eq("organization_id", organizationId)
        .eq("call_id", callId)
        .eq("updated_at", previous.updated_at)
    : db
        .from("coaching_call_notes")
        .insert({ organization_id: organizationId, call_id: callId, body: text });
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("This note changed or you no longer have permission. Reload before saving.");
  return data as CallNote;
}
export async function deleteCallNote(note: CallNote) {
  const { data, error } = await db
    .from("coaching_call_notes")
    .delete()
    .eq("id", note.id)
    .eq("organization_id", note.organization_id)
    .eq("call_id", note.call_id)
    .eq("updated_at", note.updated_at)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This note changed or could not be deleted. Reload and try again.");
}
export const coachingAssignmentsQuery = (org: string) =>
  queryOptions({
    queryKey: ["coaching-assignments", org],
    enabled: !!org,
    queryFn: async (): Promise<CoachingAssignment[]> => {
      const rows: CoachingAssignment[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("coaching_assignments")
          .select("*")
          .eq("organization_id", org)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Assignments could not load.");
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
export async function createCoachingAssignment(
  input: Pick<
    CoachingAssignment,
    "organization_id" | "rep_id" | "call_id" | "run_id" | "focus" | "note" | "check_in_at"
  >,
) {
  const focus = input.focus.trim();
  if (!focus || focus.length > 300) throw new Error("Enter a focus up to 300 characters.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.check_in_at) ||
    !Number.isFinite(Date.parse(input.check_in_at))
  )
    throw new Error("Choose a check-in date.");
  const { data, error } = await db
    .from("coaching_assignments")
    .insert({ ...input, focus, note: input.note.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as CoachingAssignment;
}
export async function updateCoachingAssignment(
  previous: CoachingAssignment,
  patch: Partial<Pick<CoachingAssignment, "status" | "check_in_note" | "check_in_at">>,
) {
  const { data, error } = await db
    .from("coaching_assignments")
    .update(patch)
    .eq("id", previous.id)
    .eq("organization_id", previous.organization_id)
    .eq("updated_at", previous.updated_at)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Assignment changed or permission was denied. Refresh and retry.");
  return data as CoachingAssignment;
}
