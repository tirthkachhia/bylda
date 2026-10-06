import type { ID, ISODate, SignalTone } from "./common";
import type { Insight } from "./insight";

/** 12 Rooms — MOCKS ONLY (no backend: rooms/room_members/messages/threads are MISSING). */
export type RoomKind = "channel" | "brief" | "coaching" | "team" | "deal";

export type Room = {
  id: ID;
  slug: string;
  name: string;
  kind: RoomKind;
  topic: string;
  memberCount: number;
  unread: number;
  hasMention: boolean;
  isMember: boolean;
};

export type MessageBlock =
  | { type: "report"; title: string; meta: string; reportId: ID }
  | {
      type: "call";
      title: string;
      meta: string;
      callId: ID;
      moment: { label: string; tone: SignalTone } | null;
    }
  | { type: "coaching"; title: string; meta: string; focusId: ID }
  | { type: "structured"; columns: [Col, Col, Col] }
  | { type: "insight"; insight: Insight };
type Col = { title: string; body: string };

export type Reaction = { symbol: string; count: number; mine: boolean };

export type Message = {
  id: ID;
  roomId: ID | null;
  threadId: ID | null;
  authorId: ID;
  authorName: string;
  isApp: boolean;
  body: string;
  block: MessageBlock | null;
  reactions: Reaction[];
  replyCount: number;
  createdAt: ISODate;
};

export type DmThread = {
  id: ID;
  title: string;
  participantIds: ID[];
  unread: number;
  isCoach: boolean;
};
