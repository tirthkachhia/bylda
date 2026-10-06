import type { ID, ISODate } from "./common";

/** N1 / N2. Severity is a dot and a word — never a red badge or a pile-up count. */
export type NotificationType =
  | "behavior_regression"
  | "important_call"
  | "emerging_pattern"
  | "report_ready"
  | "coaching_completed"
  | "coaching_acknowledged"
  | "methodology_breakdown"
  | "integration_problem"
  | "behavior_improvement";

export type Notification = {
  id: ID;
  type: NotificationType;
  /** "BEHAVIOR REGRESSION" */
  typeLabel: string;
  severity: "info" | "attention" | "regress" | "improve";
  title: string;
  body: string | null;
  href: string;
  read: boolean;
  createdAt: ISODate;
};

/** B-screens — mobile push registration (GAPS 14). */
export type PushRegistration = {
  platform: "ios" | "android" | "web";
  enabled: boolean;
  registeredAt: ISODate | null;
};
