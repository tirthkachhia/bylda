import { NotBuiltError } from "../core/errors";
import type { MessageRow, RoomRow } from "./map";

/** C-25 · rooms */
export async function fetchRooms(): Promise<RoomRow[]> {
  throw new NotBuiltError("rooms");
}
/** C-25 · messages */
export async function fetchMessages(_scope: {
  roomId?: string;
  threadId?: string;
}): Promise<MessageRow[]> {
  throw new NotBuiltError("messages");
}
