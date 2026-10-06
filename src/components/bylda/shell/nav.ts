import type { IconName } from "../kit/Icon";
import type { Role } from "@/lib/data/types";

/**
 * Static, role-aware nav (CLAUDE.md §12 G). Lanes never edit this — every V1 screen
 * already has a route, and every top-level area already has a link here.
 *
 * Rep rule: a Rep NEVER sees Team, Intelligence (team-wide), comparison or
 * leaderboard entries. Their links go to their own views only.
 */
export type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  /** resolved href for this role */
  to: string;
  /** path prefixes that mark this item active */
  match: string[];
};

type NavSpec = {
  key: string;
  label: string;
  icon: IconName;
  roles: Role[];
  to: (role: Role, viewerId: string) => string;
  match: (role: Role) => string[];
};

const ALL: Role[] = ["owner", "admin", "manager", "rep", "viewer", "coach"];
const LEADERS: Role[] = ["owner", "admin", "manager", "coach", "viewer"];

const PRIMARY: NavSpec[] = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    roles: ALL,
    to: (r) =>
      r === "rep" ? "/app/rep" : r === "owner" || r === "admin" ? "/app/home/admin" : "/app/home",
    match: (r) => (r === "rep" ? ["/app/rep"] : ["/app/home"]),
  },
  {
    key: "intelligence",
    label: "Intelligence",
    icon: "intelligence",
    roles: LEADERS,
    to: () => "/app/intelligence",
    match: () => ["/app/intelligence"],
  },
  {
    key: "calls",
    label: "Calls",
    icon: "calls",
    roles: ["owner", "admin", "manager", "coach", "viewer", "rep"],
    to: (r) => (r === "rep" ? "/app/calls/mine" : "/app/calls"),
    match: () => ["/app/calls"],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "reports",
    roles: ALL,
    to: (r, id) => (r === "rep" ? `/app/reports/rep/${id}` : "/app/reports"),
    match: () => ["/app/reports"],
  },
  {
    key: "team",
    label: "Team",
    icon: "team",
    roles: ["owner", "admin", "manager", "coach", "viewer"],
    to: () => "/app/team",
    match: () => ["/app/team"],
  },
  {
    key: "coaching",
    label: "Coaching",
    icon: "coaching",
    roles: ["owner", "admin", "manager", "coach", "rep"],
    to: (r) => (r === "rep" ? "/app/coaching/mine" : "/app/coaching"),
    match: () => ["/app/coaching"],
  },
  {
    key: "progress",
    label: "My progress",
    icon: "trend",
    roles: ["rep"],
    to: () => "/app/rep/progress",
    match: () => ["/app/rep/progress"],
  },
  {
    key: "rooms",
    label: "Rooms",
    icon: "rooms",
    roles: ALL,
    to: () => "/app/rooms",
    match: () => ["/app/rooms", "/app/dm"],
  },
];

const BOTTOM: NavSpec[] = [
  {
    key: "integrations",
    label: "Integrations",
    icon: "plug",
    roles: ["owner", "admin"],
    to: () => "/app/connections",
    match: () => ["/app/connections"],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    roles: ALL,
    to: (r) => (r === "owner" || r === "admin" ? "/app/workspace" : "/app/workspace/profile"),
    match: () => ["/app/workspace", "/app/methodology"],
  },
];

const resolve = (specs: NavSpec[], role: Role, viewerId: string): NavItem[] =>
  specs
    .filter((s) => s.roles.includes(role))
    .map((s) => ({
      key: s.key,
      label: s.label,
      icon: s.icon,
      to: s.to(role, viewerId),
      match: s.match(role),
    }));

export function navFor(role: Role, viewerId: string) {
  return { primary: resolve(PRIMARY, role, viewerId), bottom: resolve(BOTTOM, role, viewerId) };
}

const matches = (m: string, pathname: string) => pathname === m || pathname.startsWith(`${m}/`);

/** The key of the item whose match prefix is the longest one containing `pathname`. */
export function activeKey(
  items: Pick<NavItem, "key" | "match">[],
  pathname: string,
): string | null {
  let best: { key: string; len: number } | null = null;
  for (const item of items) {
    for (const m of item.match) {
      if (matches(m, pathname) && (!best || m.length > best.len))
        best = { key: item.key, len: m.length };
    }
  }
  return best?.key ?? null;
}

/** "+ New" menu (50:27367). */
export type NewMenuItem = {
  key: string;
  label: string;
  icon: IconName;
  shortcut: string;
  to?: string;
  action?: "ask";
};
export function newMenuFor(role: Role): NewMenuItem[] {
  const items: (NewMenuItem & { roles: Role[] })[] = [
    {
      key: "upload",
      label: "Upload a call",
      icon: "calls",
      shortcut: "U",
      to: "/app/calls/upload",
      roles: ["owner", "admin", "manager", "coach", "rep"],
    },
    {
      key: "coach",
      label: "Assign coaching",
      icon: "coaching",
      shortcut: "C",
      to: "/app/coaching/assign",
      roles: ["owner", "admin", "manager", "coach"],
    },
    {
      key: "room",
      label: "New room",
      icon: "rooms",
      shortcut: "R",
      to: "/app/rooms/new",
      roles: ALL,
    },
    {
      key: "dm",
      label: "Direct message",
      icon: "user",
      shortcut: "D",
      to: "/app/dm/new",
      roles: ALL,
    },
    {
      key: "report",
      label: "New report",
      icon: "reports",
      shortcut: "P",
      to: "/app/reports",
      roles: ["owner", "admin", "manager", "viewer"],
    },
    {
      key: "ask",
      label: "Ask Bylda",
      icon: "intelligence",
      shortcut: "/",
      action: "ask",
      roles: ALL,
    },
  ];
  return items.filter((i) => i.roles.includes(role)).map(({ roles: _roles, ...rest }) => rest);
}

/** Rep safety check used by tests: no rep nav item may point at a team-wide or comparison view. */
export const REP_FORBIDDEN_PREFIXES = [
  "/app/team",
  "/app/intelligence",
  "/app/home",
  "/app/calls/compare",
  "/app/coaching/assign",
];
