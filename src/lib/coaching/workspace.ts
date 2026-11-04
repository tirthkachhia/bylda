import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export type Team = {
  id: string;
  organization_id: string;
  name: string;
  manager_id: string | null;
  rep_ids: string[];
  playbook_id: string | null;
  updated_at: string;
};
export type Room = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  visibility: "workspace" | "private";
  member_ids: string[];
  created_by: string | null;
  created_at: string;
};
export type RoomMessage = {
  id: string;
  room_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};
export const teamsQuery = (org: string) =>
  queryOptions({
    queryKey: ["coaching-teams", org],
    enabled: !!org,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await db
        .from("coaching_teams")
        .select("*")
        .eq("organization_id", org)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
export async function saveTeam(
  org: string,
  fields: Pick<Team, "name" | "manager_id" | "rep_ids" | "playbook_id">,
  previous?: Team,
) {
  if (!fields.name.trim()) throw new Error("Enter a team name.");
  const q = previous
    ? db
        .from("coaching_teams")
        .update(fields)
        .eq("organization_id", org)
        .eq("id", previous.id)
        .eq("updated_at", previous.updated_at)
    : db.from("coaching_teams").insert({ ...fields, organization_id: org });
  const { data, error } = await q.select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Team changed or permission denied.");
  return data as Team;
}
export const roomsQuery = (org: string) =>
  queryOptions({
    queryKey: ["coaching-rooms", org],
    enabled: !!org,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await db
        .from("coaching_rooms")
        .select("*")
        .eq("organization_id", org)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
export async function createRoom(
  input: Pick<Room, "organization_id" | "name" | "description" | "visibility" | "member_ids">,
) {
  const { data, error } = await db.from("coaching_rooms").insert(input).select().single();
  if (error) throw error;
  return data as Room;
}
export const roomMessagesQuery = (roomId: string) =>
  queryOptions({
    queryKey: ["coaching-room-messages", roomId],
    enabled: !!roomId,
    refetchInterval: 15000,
    queryFn: async (): Promise<RoomMessage[]> => {
      const rows: RoomMessage[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("coaching_room_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at")
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Messages could not load.");
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    },
  });
export async function saveRoomMessage(roomId: string, body: string) {
  const text = body.trim();
  if (!text || text.length > 10000) throw new Error("Enter up to 10,000 characters.");
  const { data, error } = await db
    .from("coaching_room_messages")
    .insert({ room_id: roomId, body: text })
    .select()
    .single();
  if (error) throw error;
  return data as RoomMessage;
}
export async function deleteRoomMessage(row: RoomMessage) {
  const { data, error } = await db
    .from("coaching_room_messages")
    .delete()
    .eq("id", row.id)
    .eq("room_id", row.room_id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Message could not be deleted.");
}
