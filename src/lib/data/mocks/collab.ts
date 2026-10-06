import type {
  Brief,
  DataSource,
  DeliveryChannel,
  DmThread,
  FieldMapping,
  Message,
  Notification,
  ReportListItem,
  Room,
} from "../types";
import { INSIGHTS } from "./intelligence";

/** 12 Rooms (mocks only), 14 Notifications, 10 Reports, 15 Integrations. */
export const ROOMS: Room[] = [
  {
    id: "room_brief",
    slug: "daily-brief",
    name: "daily-brief",
    kind: "brief",
    topic: "Bylda posts the manager brief here every morning.",
    memberCount: 11,
    unread: 1,
    hasMention: false,
    isMember: true,
  },
  {
    id: "room_coaching",
    slug: "coaching",
    name: "coaching",
    kind: "coaching",
    topic: "Coaching focuses and results.",
    memberCount: 11,
    unread: 0,
    hasMention: false,
    isMember: true,
  },
  {
    id: "room_objections",
    slug: "objection-watch",
    name: "objection-watch",
    kind: "channel",
    topic: "Objections Bylda is tracking across the team.",
    memberCount: 12,
    unread: 9,
    hasMention: true,
    isMember: true,
  },
  {
    id: "room_wins",
    slug: "wins",
    name: "wins",
    kind: "channel",
    topic: "Closed-won calls worth a listen.",
    memberCount: 14,
    unread: 0,
    hasMention: false,
    isMember: true,
  },
  {
    id: "room_lost",
    slug: "lost-deals",
    name: "lost-deals",
    kind: "channel",
    topic: "What the lost deals had in common.",
    memberCount: 9,
    unread: 0,
    hasMention: false,
    isMember: true,
  },
  {
    id: "room_mm",
    slug: "mid-market-team",
    name: "mid-market-team",
    kind: "team",
    topic: "Mid-Market AE team room.",
    memberCount: 10,
    unread: 0,
    hasMention: false,
    isMember: true,
  },
  {
    id: "room_acme",
    slug: "acme-logistics",
    name: "acme-logistics",
    kind: "deal",
    topic: "Deal room — Acme Logistics, Pricing stage.",
    memberCount: 4,
    unread: 0,
    hasMention: false,
    isMember: true,
  },
];

export const MESSAGES: Message[] = [
  {
    id: "m1",
    roomId: "room_objections",
    threadId: null,
    authorId: "bylda",
    authorName: "Bylda",
    isApp: true,
    body: "Price objections handled early this week:",
    block: {
      type: "structured",
      columns: [
        { title: "Key moment", body: "Acme CFO voiced rollout risk at 18:42; treated as price." },
        {
          title: "Behavioral insight",
          body: "Reps answered before diagnosing in 7 of 9 price objections.",
        },
        { title: "Today’s focus", body: "Pause · ask “what’s behind that?” · then answer." },
      ],
    },
    reactions: [
      { symbol: "◉", count: 3, mine: false },
      { symbol: "✓", count: 2, mine: true },
    ],
    replyCount: 2,
    createdAt: "2026-09-30T08:10:00Z",
  },
  {
    id: "m2",
    roomId: "room_objections",
    threadId: null,
    authorId: "u_dana",
    authorName: "Dana Whitfield",
    isApp: false,
    body: "Worth 5 minutes before your pricing calls today.",
    block: {
      type: "call",
      title: "Jordan × Acme Logistics",
      meta: "38 min · Mon 2:00 PM · 4 key moments",
      callId: "call_acme",
      moment: { label: "Lost control 18:42", tone: "regress" },
    },
    reactions: [],
    replyCount: 0,
    createdAt: "2026-09-30T08:20:00Z",
  },
  {
    id: "m3",
    roomId: "room_brief",
    threadId: null,
    authorId: "bylda",
    authorName: "Bylda",
    isApp: true,
    body: "",
    block: {
      type: "report",
      title: "Weekly Sales Behavior Report",
      meta: "Report · Wk 39 · 5-min read",
      reportId: "rep_weekly_39",
    },
    reactions: [],
    replyCount: 0,
    createdAt: "2026-09-29T07:00:00Z",
  },
  {
    id: "m4",
    roomId: null,
    threadId: "dm_dana_jordan",
    authorId: "u_dana",
    authorName: "Dana Whitfield",
    isApp: false,
    body: "Nice pause on the Brightline call — that’s the one.",
    block: null,
    reactions: [],
    replyCount: 0,
    createdAt: "2026-09-29T18:00:00Z",
  },
  {
    id: "m5",
    roomId: null,
    threadId: "dm_coach",
    authorId: "bylda",
    authorName: "BYLDA Coach",
    isApp: true,
    body: "",
    block: {
      type: "coaching",
      title: "Focus: pause after objections",
      meta: "Jordan · measured on next 5 objections · 2 clips attached",
      focusId: "cf_jordan_pause",
    },
    reactions: [],
    replyCount: 0,
    createdAt: "2026-09-29T12:00:00Z",
  },
];

export const DM_THREADS: DmThread[] = [
  {
    id: "dm_dana_jordan",
    title: "Jordan Reyes",
    participantIds: ["u_dana", "u_jordan"],
    unread: 2,
    isCoach: false,
  },
  {
    id: "dm_dana_kiran",
    title: "Kiran Patel",
    participantIds: ["u_dana", "u_kiran"],
    unread: 0,
    isCoach: false,
  },
  { id: "dm_coach", title: "BYLDA Coach", participantIds: ["bylda"], unread: 0, isCoach: true },
];

export const SAVED_COUNT = 12;

/**
 * Notification timestamps are relative to load time, so Today / Earlier always read like the
 * Figma frames (4 today, then yesterday, then older days). Today rows are clamped into the
 * current local day and never land in the future; weekday names are not meant to match Figma.
 */
const NOW = Date.now();
const startOfToday = new Date(NOW).setHours(0, 0, 0, 0);
const todayAgo = (minutesAgo: number, floorMinutes: number) =>
  new Date(
    Math.min(NOW, Math.max(NOW - minutesAgo * 60_000, startOfToday + floorMinutes * 60_000)),
  ).toISOString();
const daysAgoAt = (days: number, hour: number, minute = 0) => {
  const d = new Date(NOW);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - days, hour, minute).toISOString();
};

/**
 * N1 / N2 — the manager's (Dana's) inbox: the nine rows in Figma (31:1101 drawer, 31:1258
 * center), newest first. Every type and every severity appears once; the three unread rows are
 * the three that carry a coloured dot. Figma shows no body line on any row, so `body` is null
 * throughout. Row 8 is `regress` because Figma colours INTEGRATION PROBLEM red; the legacy
 * mapper (map.ts) still derives `attention` from the type until C-22 stores severity per row.
 * Hrefs follow the routes lane screens already match on (/app/calls/:id, /app/coaching/:id).
 */
export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "behavior_regression",
    typeLabel: "BEHAVIOR REGRESSION",
    severity: "regress",
    title: "Sarah’s interruptions are 18% above her baseline.",
    body: null,
    href: "/app/intelligence/behaviors/interrupting_during_objections",
    read: false,
    createdAt: todayAgo(5, 4),
  },
  {
    id: "n2",
    type: "important_call",
    typeLabel: "IMPORTANT CALL",
    severity: "attention",
    title: "Acme Logistics stalled after a price objection — worth 90 seconds.",
    body: null,
    href: "/app/calls/call_acme",
    read: false,
    createdAt: todayAgo(11, 3),
  },
  {
    id: "n3",
    type: "emerging_pattern",
    typeLabel: "EMERGING PATTERN",
    severity: "info",
    title: "Price objections up 31% across the team.",
    body: null,
    href: "/app/intelligence/patterns",
    read: false,
    createdAt: todayAgo(17, 2),
  },
  {
    id: "n4",
    type: "report_ready",
    typeLabel: "REPORT READY",
    severity: "info",
    title: "Daily Manager Brief — 2 min read.",
    body: null,
    href: "/app/reports/daily",
    read: true,
    createdAt: todayAgo(49, 1),
  },
  {
    id: "n5",
    type: "coaching_completed",
    typeLabel: "COACHING COMPLETED",
    severity: "improve",
    title: "Alex’s focus held for 3 weeks.",
    body: null,
    href: "/app/coaching/cf_alex_pause/result",
    read: true,
    createdAt: daysAgoAt(1, 10),
  },
  {
    id: "n6",
    type: "coaching_acknowledged",
    typeLabel: "COACHING ACKNOWLEDGED",
    severity: "info",
    title: "Jordan acknowledged “Pause after objections”.",
    body: null,
    href: "/app/coaching/cf_jordan_pause",
    read: true,
    createdAt: daysAgoAt(1, 9),
  },
  {
    id: "n7",
    type: "methodology_breakdown",
    typeLabel: "METHODOLOGY BREAKDOWN",
    severity: "attention",
    title: "Economic buyer missing on 3 deals in Pricing.",
    body: null,
    href: "/app/methodology",
    read: true,
    createdAt: daysAgoAt(2, 9),
  },
  {
    id: "n8",
    type: "integration_problem",
    typeLabel: "INTEGRATION PROBLEM",
    severity: "regress",
    title: "Aircall disconnected — 23 calls waiting.",
    body: null,
    href: "/app/connections",
    read: true,
    createdAt: daysAgoAt(3, 12),
  },
  {
    id: "n9",
    type: "behavior_improvement",
    typeLabel: "BEHAVIOR IMPROVEMENT",
    severity: "improve",
    title: "Priya’s next-step rate reached her target (81%).",
    body: null,
    href: "/app/team/reps/u_priya",
    read: true,
    createdAt: daysAgoAt(4, 10),
  },
];

/**
 * Inboxes of mock viewers other than the manager, keyed by owner = recipient (the real table's
 * `user_id`). `Notification` carries no owner or subject field, so who a row belongs to is
 * exactly which inbox it sits in; the loader in notifications/hooks.ts never reads across
 * inboxes for a rep. Jordan's rows are about Jordan alone, in the second person, and name no
 * one else: a rep-facing payload must not mention anyone else. Kept out of NOTIFICATIONS so the
 * manager's feed stays the nine Figma rows.
 */
export const REP_NOTIFICATIONS: Record<string, Notification[]> = {
  u_jordan: [
    {
      id: "n10",
      type: "behavior_regression",
      typeLabel: "BEHAVIOR REGRESSION",
      severity: "regress",
      title: "Your pause after objections dropped to 0.4s.",
      body: null,
      href: "/app/rep/progress",
      read: false,
      createdAt: todayAgo(7, 3),
    },
    {
      id: "n13",
      type: "important_call",
      typeLabel: "IMPORTANT CALL",
      severity: "attention",
      title: "Your Acme Logistics call stalled after a price objection — worth 90 seconds.",
      body: null,
      href: "/app/calls/call_acme",
      read: false,
      createdAt: todayAgo(26, 2),
    },
    {
      id: "n11",
      type: "behavior_improvement",
      typeLabel: "BEHAVIOR IMPROVEMENT",
      severity: "improve",
      title: "Your discovery questions per call reached your target.",
      body: null,
      href: "/app/rep/progress",
      read: true,
      createdAt: daysAgoAt(1, 11),
    },
    {
      id: "n12",
      type: "coaching_acknowledged",
      typeLabel: "COACHING ACKNOWLEDGED",
      severity: "info",
      title:
        "You acknowledged “Pause after objections”. Bylda will measure it over your next 5 objections.",
      body: null,
      href: "/app/coaching/cf_jordan_pause",
      read: true,
      createdAt: daysAgoAt(2, 10),
    },
  ],
};

export const REPORTS: ReportListItem[] = [
  {
    id: "rep_daily_0930",
    kind: "daily_manager",
    title: "Daily Manager Brief",
    period: "Tue 30 Sep",
    generatedAt: "2026-09-30T07:00:00Z",
  },
  {
    id: "rep_weekly_39",
    kind: "weekly_manager",
    title: "Weekly Sales Behavior Report",
    period: "Wk 39",
    generatedAt: "2026-09-29T07:00:00Z",
  },
  {
    id: "rep_rep_jordan_39",
    kind: "weekly_rep",
    title: "Weekly Rep Report — Jordan",
    period: "Wk 39",
    generatedAt: "2026-09-29T07:00:00Z",
  },
];

export function mockBrief(id: string): Brief | null {
  const r = REPORTS.find((x) => x.id === id);
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    period: r.period,
    subjectId: r.kind === "weekly_rep" ? "u_jordan" : "team_mm",
    generatedAt: r.generatedAt,
    readMinutes: 5,
    sections: [
      { heading: "Three calls worth your time today", body: null, insights: [INSIGHTS[0]] },
      { heading: "Patterns", body: null, insights: [INSIGHTS[1]] },
    ],
  };
}

export const DATA_SOURCES: DataSource[] = [
  {
    key: "zoom",
    name: "Zoom",
    category: "meetings",
    status: "connected",
    lastSyncAt: "2026-09-30T07:45:00Z",
    callsSynced: 412,
    waiting: 0,
    error: null,
  },
  {
    key: "aircall",
    name: "Aircall",
    category: "dialer",
    status: "error",
    lastSyncAt: "2026-09-27T12:00:00Z",
    callsSynced: 74,
    waiting: 23,
    error: "The access token expired.",
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "crm",
    status: "connected",
    lastSyncAt: "2026-09-30T07:40:00Z",
    callsSynced: 0,
    waiting: 0,
    error: null,
  },
  {
    key: "gong",
    name: "Gong",
    category: "recorder",
    status: "not_connected",
    lastSyncAt: null,
    callsSynced: 0,
    waiting: 0,
    error: null,
  },
];

export const DELIVERY_CHANNELS: DeliveryChannel[] = [
  { key: "slack", name: "Slack", status: "connected", destinations: ["#sales-leadership"] },
  { key: "email", name: "Email", status: "connected", destinations: ["dana@acme-revenue.test"] },
  { key: "teams", name: "Microsoft Teams", status: "not_connected", destinations: [] },
  { key: "push", name: "Mobile push", status: "not_connected", destinations: [] },
];

export const HUBSPOT_MAPPINGS: FieldMapping[] = [
  {
    byldaField: "Call outcome",
    crmObject: "Deal",
    crmField: "dealstage",
    direction: "read",
    required: true,
  },
  {
    byldaField: "Stage at call",
    crmObject: "Deal",
    crmField: "dealstage",
    direction: "read",
    required: true,
  },
  {
    byldaField: "Account",
    crmObject: "Company",
    crmField: "name",
    direction: "read",
    required: true,
  },
  {
    byldaField: "Opportunity",
    crmObject: "Deal",
    crmField: null,
    direction: "read",
    required: false,
  },
];
