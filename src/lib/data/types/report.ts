import type { ID, ISODate } from "./common";
import type { Insight } from "./insight";

export type BriefKind =
  | "daily_manager"
  | "daily_rep"
  | "weekly_manager"
  | "weekly_rep"
  | "team"
  | "behavior";

export type BriefSection = { heading: string; body: string | null; insights: Insight[] };

/** P1–P10: every report is a Brief; channel (in-app, email, push, print) is presentation. */
export type Brief = {
  id: ID;
  kind: BriefKind;
  title: string;
  /** "Wk 39", "September", "Mon 29 Sep" */
  period: string;
  subjectId: ID | null;
  generatedAt: ISODate;
  readMinutes: number;
  sections: BriefSection[];
};

export type ReportListItem = {
  id: ID;
  kind: BriefKind;
  title: string;
  period: string;
  generatedAt: ISODate;
};
