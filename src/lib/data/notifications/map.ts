import type { Notification, NotificationType, PushRegistration } from "../types";

const V1_TYPES: NotificationType[] = [
  "behavior_regression",
  "important_call",
  "emerging_pattern",
  "report_ready",
  "coaching_completed",
  "coaching_acknowledged",
  "methodology_breakdown",
  "integration_problem",
  "behavior_improvement",
];
const SEVERITY: Record<NotificationType, Notification["severity"]> = {
  behavior_regression: "regress",
  important_call: "attention",
  emerging_pattern: "info",
  report_ready: "info",
  coaching_completed: "improve",
  coaching_acknowledged: "info",
  methodology_breakdown: "attention",
  integration_problem: "attention",
  behavior_improvement: "improve",
};

const isDesigned = (t: string | null): t is NotificationType =>
  (V1_TYPES as string[]).includes(t ?? "");

/** Raw types already warned about this session, so one drifting type is one line, not one per row. */
const warnedTypes = new Set<string>();

/** Tests only — forget which unknown types were already warned about. */
export function resetUnknownTypeWarnings() {
  warnedTypes.clear();
}

/** Dev only: say once per raw type that rows of it are being left out (LANE_REQUESTS F-2). */
function warnUnknownType(raw: string | null) {
  if (!import.meta.env.DEV) return;
  const key = raw ?? "(null)";
  if (warnedTypes.has(key)) return;
  warnedTypes.add(key);
  console.warn(
    `[notifications] rows of type "${key}" are left out: it is not one of the designed types. ` +
      `Drift between the backend and NotificationType (LANE_REQUESTS F-2).`,
  );
}

/**
 * Today's row. A type that isn't one of the designed ones returns null: the row is dropped, not
 * rewritten as something else, so it never shows under a label that isn't its own. Live data is
 * legacy `new_lead` only (F-2). Title = message.
 */
export function mapNotificationRow(r: {
  id: string;
  type: string | null;
  message: string | null;
  read: boolean | null;
  created_at: string;
}): Notification | null {
  if (!isDesigned(r.type)) {
    warnUnknownType(r.type);
    return null;
  }
  const type = r.type;
  return {
    id: r.id,
    type,
    typeLabel: type.replace(/_/g, " ").toUpperCase(),
    severity: SEVERITY[type],
    title: r.message ?? "",
    // GAP: body / href — C-22
    body: null,
    href: "/app/notifications",
    read: !!r.read,
    createdAt: r.created_at,
  };
}

/** The list the hooks serve: dropped rows are gone, so no count or the bell dot ever sees them. */
export const mapNotificationRows = (rows: Parameters<typeof mapNotificationRow>[0][]) =>
  rows.map(mapNotificationRow).filter((n): n is Notification => n !== null);

/** C-22 · proposed notifications row after the V1 columns land. */
export type NotificationV1Row = {
  id: string;
  user_id: string;
  organization_id: string;
  type: NotificationType;
  severity: Notification["severity"];
  title: string;
  body: string | null;
  href: string;
  read: boolean;
  created_at: string;
};
export const mapNotificationV1 = (r: NotificationV1Row): Notification => ({
  id: r.id,
  type: r.type,
  typeLabel: r.type.replace(/_/g, " ").toUpperCase(),
  severity: r.severity,
  title: r.title,
  body: r.body,
  href: r.href,
  read: r.read,
  createdAt: r.created_at,
});

/** C-37 · proposed push_subscriptions row */
export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  platform: PushRegistration["platform"];
  token: string;
  enabled: boolean;
  created_at: string;
};
export const mapPushSubscription = (r: PushSubscriptionRow): PushRegistration => ({
  platform: r.platform,
  enabled: r.enabled,
  registeredAt: r.created_at,
});
