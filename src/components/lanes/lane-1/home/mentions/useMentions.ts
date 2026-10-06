import { mocksForced, useViewer } from "@/lib/data";
import type { QueryLike } from "@/components/bylda";

/**
 * GAP: there is no mentions source in `@/lib/data` — Rooms and DMs are mock-only (C-33 / C-34)
 * and `Message` carries no `mentions` or read state. Until Tirth builds it this lane-local hook
 * serves a typed fixture in mock mode ONLY and nothing otherwise, so a real workspace never
 * sees invented mentions. Logged in LANE_REQUESTS #33 as `fold-into-data` (`useMentions`).
 */
export type Mention = {
  id: string;
  fromName: string;
  where: { kind: "room"; slug: string } | { kind: "dm" };
  /** `{viewer}` is replaced with the viewer's first name */
  body: string;
  hoursAgo: number;
  unread: boolean;
};

const FIXTURE: Mention[] = [
  {
    id: "m_mia_northwind",
    fromName: "Mia Kowalski",
    where: { kind: "room", slug: "objection-watch" },
    body: "@{viewer} should I use the Brightline clip for my Northwind follow-up too?",
    hoursAgo: 2,
    unread: true,
  },
  {
    id: "m_kiran_brief",
    fromName: "Kiran Patel",
    where: { kind: "room", slug: "daily-brief" },
    body: "@{viewer} can we get this brief for Enterprise as well?",
    hoursAgo: 26,
    unread: false,
  },
  {
    id: "m_jordan_dm",
    fromName: "Jordan Reyes",
    where: { kind: "dm" },
    body: "@{viewer} listened to 18:42 — I see it now. Trying the question today.",
    hoursAgo: 28,
    unread: false,
  },
];

export function useMentions(): QueryLike<Mention[]> {
  const viewer = useViewer();
  const first = viewer.data?.name.trim().split(/\s+/)[0] ?? "";
  const data =
    mocksForced() && first
      ? FIXTURE.map((m) => ({ ...m, body: m.body.replace("{viewer}", first) }))
      : [];
  return { data, isLoading: viewer.isLoading, error: viewer.error, isEmpty: data.length === 0 };
}
