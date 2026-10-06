import type {
  Call,
  CoachingFocus,
  DataSource,
  DeliveryChannel,
  Member,
  Methodology,
  Pattern,
  Person,
  TeamSummary,
  WorkspaceHealth,
} from "@/lib/data";
import { DAY_MS } from "../shared/format";

/**
 * H7 Admin Home — pure derivations from `@/lib/data` rows. No hooks, no clock reads (callers
 * pass `now`), so every sentence on the screen is testable. Nothing here invents a number:
 * a figure the data can't supply is returned as `null` and rendered as an em dash.
 */

// ── Sources ────────────────────────────────────────────────────────────────────────────

export const isBroken = (s: DataSource) => s.status === "error" || s.status === "disconnected";

/** Sources the workspace has set up at some point — `not_connected` is a catalog entry, not a source. */
export const trackedSources = (sources: DataSource[]) =>
  sources.filter((s) => s.status !== "not_connected");

export function sourcesTile(sources: DataSource[]) {
  const tracked = trackedSources(sources);
  return {
    connected: tracked.filter((s) => s.status === "connected").length,
    total: tracked.length,
    broken: tracked.filter(isBroken),
  };
}

// ── Teams ──────────────────────────────────────────────────────────────────────────────

export function teamsTile(teams: TeamSummary[]) {
  return {
    active: teams.filter((t) => t.status === "active").length,
    total: teams.length,
    unset: teams.filter((t) => t.status === "setup"),
  };
}

// ── Calls (last 7 days) ────────────────────────────────────────────────────────────────

export function callsTile(calls: Call[], now: number) {
  const recent = calls.filter((c) => Date.parse(c.startedAt) >= now - 7 * DAY_MS);
  const analyzed = recent.filter((c) => c.status === "ready").length;
  return {
    total: recent.length,
    /** whole percent, `null` when there are no calls to take a share of */
    analyzedPct: recent.length === 0 ? null : Math.round((analyzed / recent.length) * 100),
  };
}

// ── Coaching ───────────────────────────────────────────────────────────────────────────

const ACTIVE_FOCUS = ["assigned", "acknowledged", "measuring"] as const;
export const isActiveFocus = (f: CoachingFocus) =>
  (ACTIVE_FOCUS as readonly string[]).includes(f.status);

/** Focuses acknowledged within 24h of being assigned, out of all focuses assigned. */
export function focusAckTile(foci: CoachingFocus[]) {
  const within24h = foci.filter(
    (f) =>
      f.acknowledgedAt !== null &&
      Date.parse(f.acknowledgedAt) - Date.parse(f.assignedAt) <= DAY_MS,
  ).length;
  return { within24h, total: foci.length };
}

// ── Needs you ──────────────────────────────────────────────────────────────────────────

export type NeedsYouItem = {
  id: string;
  title: string;
  /** the broken source this item is about, when one can be identified */
  source: DataSource | null;
};

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * What needs the owner. `health.alerts` is authoritative text but is empty until C-31 lands, so
 * a broken source with no alert about it still surfaces — otherwise this screen would say all is
 * well while a dialer is down. Alert ↔ source linkage is by name (the alert row carries no key —
 * LANE_REQUESTS #52).
 */
export function needsYou(health: WorkspaceHealth, sources: DataSource[]): NeedsYouItem[] {
  const broken = trackedSources(sources).filter(isBroken);
  const nameIn = (title: string, s: DataSource) =>
    title.toLowerCase().includes(s.name.toLowerCase());
  const waiting = (s: DataSource | null) =>
    s && s.waiting > 0 ? ` ${s.waiting} ${s.waiting === 1 ? "call is" : "calls are"} waiting.` : "";

  const fromAlerts = health.alerts.map((a) => {
    const source = broken.find((s) => nameIn(a.title, s)) ?? null;
    return { id: a.id, title: `${a.title.replace(/\.$/, "")}.${waiting(source)}`, source };
  });
  const covered = new Set(fromAlerts.flatMap((i) => (i.source ? [i.source.key] : [])));
  const fromSources = broken
    .filter((s) => !covered.has(s.key))
    .map((s) => ({
      id: `src:${s.key}`,
      title: `${s.name} ${s.status === "error" ? "stopped syncing" : "is disconnected"}${
        s.lastSyncAt ? ` — last sync ${shortDate.format(new Date(s.lastSyncAt))}` : ""
      }.${waiting(s)}`,
      source: s,
    }));
  return [...fromAlerts, ...fromSources];
}

// ── Headline ───────────────────────────────────────────────────────────────────────────

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Bylda is running. One thing is broken, and one team isn’t set up." — from counts, never typed. */
export function headlineFor({
  broken,
  unsetTeams,
}: {
  broken: number;
  unsetTeams: number;
}): string {
  if (broken === 0 && unsetTeams === 0) {
    return "Bylda is running. Everything is connected and every team is set up.";
  }
  const a =
    broken === 0
      ? null
      : broken === 1
        ? "one thing is broken"
        : `${word(broken)} things are broken`;
  const b =
    unsetTeams === 0
      ? null
      : unsetTeams === 1
        ? "one team isn’t set up"
        : `${word(unsetTeams)} teams aren’t set up`;
  const rest = a && b ? `${cap(a)}, and ${b}.` : `${cap((a ?? b) as string)}.`;
  return `Bylda is running. ${rest}`;
}

// ── Cross-team pattern ─────────────────────────────────────────────────────────────────

/**
 * The strongest team-scope pattern whose affected reps span two or more teams, or null.
 * "Cross-team" is inferred from the affected reps' teams — `Pattern` has no team list
 * (LANE_REQUESTS #52).
 */
export function crossTeamPattern(patterns: Pattern[], people: Person[]): Pattern | null {
  const teamOf = new Map(people.map((p) => [p.id, p.teamId]));
  const spans = (p: Pattern) =>
    new Set(p.affectedRepIds.map((id) => teamOf.get(id)).filter((t): t is string => !!t)).size >= 2;
  return (
    patterns
      .filter((p) => p.scope === "team" && spans(p))
      .sort((a, b) => b.sampleSize - a.sampleSize)[0] ?? null
  );
}

// ── Setup checklist ────────────────────────────────────────────────────────────────────

export type ChecklistLink =
  | { to: "/app/connections" }
  | { to: "/app/connections/channels" }
  | { to: "/app/methodology" }
  | { to: "/app/workspace/users" }
  | { to: "/app/team/$teamId/settings"; params: { teamId: string } };

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  link: ChecklistLink | null;
};

const nameList = (sources: DataSource[]) => sources.map((s) => s.name).join(" + ");

export function checklistFor(input: {
  methodologies: Methodology[];
  sources: DataSource[];
  members: Member[];
  channels: DeliveryChannel[];
  teams: TeamSummary[];
}): ChecklistItem[] {
  const { methodologies, sources, members, channels, teams } = input;
  const connected = trackedSources(sources).filter((s) => s.status === "connected");
  const calls = connected.filter((s) => s.category !== "crm");
  const crm = connected.filter((s) => s.category === "crm");
  const active = methodologies.filter((m) => m.isActive);
  const hasRole = (role: Member["role"]) =>
    members.some((m) => m.role === role && m.status !== "disabled");

  const items: ChecklistItem[] = [
    { id: "workspace", label: "Workspace created", done: true, link: null },
    {
      id: "methodology",
      label: active.length
        ? `Methodology: ${active.map((m) => m.name).join(", ")}`
        : "Choose a methodology",
      done: active.length > 0,
      link: { to: "/app/methodology" },
    },
    {
      id: "calls",
      label: calls.length ? `${nameList(calls)} connected` : "Connect a call source",
      done: calls.length > 0,
      link: { to: "/app/connections" },
    },
    {
      id: "crm",
      label: crm.length ? `${nameList(crm)} connected` : "Connect your CRM",
      done: crm.length > 0,
      link: { to: "/app/connections" },
    },
    {
      id: "managers",
      label: "Invite managers",
      done: hasRole("manager"),
      link: { to: "/app/workspace/users" },
    },
    {
      id: "reps",
      label: "Invite reps",
      done: hasRole("rep"),
      link: { to: "/app/workspace/users" },
    },
    {
      id: "slack",
      label:
        channels.find((c) => c.key === "slack")?.status === "connected"
          ? "Slack delivery"
          : "Set up Slack delivery",
      done: channels.find((c) => c.key === "slack")?.status === "connected",
      link: { to: "/app/connections/channels" },
    },
    ...teams
      .filter((t) => t.status === "setup")
      .map((t) => ({
        id: `team:${t.id}`,
        label: `Set up ${t.name} team`,
        done: false,
        link: { to: "/app/team/$teamId/settings", params: { teamId: t.id } } as const,
      })),
    ...trackedSources(sources)
      .filter(isBroken)
      .map((s) => ({
        id: `reconnect:${s.key}`,
        label: `Reconnect ${s.name}`,
        done: false,
        link: { to: "/app/connections" } as const,
      })),
  ];
  // Done first (Figma 31:10009), then what's left — stable within each group.
  return [...items.filter((i) => i.done), ...items.filter((i) => !i.done)];
}
