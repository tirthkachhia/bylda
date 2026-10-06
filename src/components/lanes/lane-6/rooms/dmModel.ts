import type { DmThread, Message, Viewer } from "@/lib/data";
export function canReadThread(thread: DmThread, viewer: Viewer, coach: boolean) {
  return (
    ["manager", "owner", "admin", "rep"].includes(viewer.role) &&
    (coach
      ? thread.isCoach && thread.id === "dm_coach"
      : !thread.isCoach && thread.participantIds.includes(viewer.id))
  );
}
export function threadMessages(messages: Message[], thread: DmThread, viewer: Viewer) {
  return messages.filter(
    (m) =>
      m.threadId === thread.id &&
      m.roomId === null &&
      (thread.isCoach
        ? m.isApp || m.authorId === viewer.id
        : thread.participantIds.includes(m.authorId)),
  );
}
export function roomNameError(name: string, existing: string[]) {
  const value = name.trim().replace(/^#\s*/, "");
  if (!value) return "Enter a room name.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    return "Use lowercase letters, numbers and single hyphens.";
  if (existing.includes(value)) return "A room with this name already exists.";
  return null;
}
