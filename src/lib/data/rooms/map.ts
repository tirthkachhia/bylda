import type { DmThread, Message, MessageBlock, Room } from "../types";

/** C-25 · proposed rooms row (unread / mention computed per viewer by the view). */
export type RoomRow = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  kind: Room["kind"];
  topic: string;
  member_count: number;
  unread_count: number;
  has_mention: boolean;
  is_member: boolean;
};
export const mapRoom = (r: RoomRow): Room => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  kind: r.kind,
  topic: r.topic,
  memberCount: r.member_count,
  unread: r.unread_count,
  hasMention: r.has_mention,
  isMember: r.is_member,
});

/** C-25 · proposed messages row (block is a typed jsonb union). */
export type MessageRow = {
  id: string;
  room_id: string | null;
  thread_id: string | null;
  author_id: string;
  author_name: string;
  is_app: boolean;
  body: string;
  block: MessageBlock | null;
  reactions: { symbol: string; count: number; mine: boolean }[];
  reply_count: number;
  created_at: string;
};
export const mapMessage = (r: MessageRow): Message => ({
  id: r.id,
  roomId: r.room_id,
  threadId: r.thread_id,
  authorId: r.author_id,
  authorName: r.author_name,
  isApp: r.is_app,
  body: r.body,
  block: r.block,
  reactions: r.reactions ?? [],
  replyCount: r.reply_count,
  createdAt: r.created_at,
});

/** C-35 · proposed dm_threads row (title = the other participant, per viewer). */
export type DmThreadRow = {
  id: string;
  organization_id: string;
  title: string;
  participant_ids: string[];
  unread_count: number;
  is_coach: boolean;
};
export const mapDmThread = (r: DmThreadRow): DmThread => ({
  id: r.id,
  title: r.title,
  participantIds: r.participant_ids ?? [],
  unread: r.unread_count,
  isCoach: r.is_coach,
});
