import type { DmThread, Person, Room } from "../types";

export type SidebarData = {
  rooms: Pick<Room, "id" | "slug" | "name" | "unread" | "hasMention">[];
  people: Pick<Person, "id" | "name" | "presence">[];
  dms: Pick<DmThread, "id" | "title" | "unread" | "isCoach">[];
  savedCount: number;
};

export const presenceLabel = (p: Person["presence"]) =>
  p === "on_call" ? "on a call" : p === "away" ? "away" : "";
