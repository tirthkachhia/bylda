import { mapInsight, type InsightRow } from "../insights/map";
import type { Brief, ReportListItem } from "../types";

/** C-17 · proposed briefs row (sections jsonb; each section embeds insight rows). */
export type BriefRow = {
  id: string;
  organization_id: string;
  kind: Brief["kind"];
  title: string;
  period: string;
  subject_id: string | null;
  generated_at: string;
  read_minutes: number;
  sections: { heading: string; body: string | null; insights: InsightRow[] }[];
};
export const mapBrief = (r: BriefRow): Brief => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  period: r.period,
  subjectId: r.subject_id,
  generatedAt: r.generated_at,
  readMinutes: r.read_minutes,
  sections: (r.sections ?? []).map((s) => ({
    heading: s.heading,
    body: s.body,
    insights: s.insights.map(mapInsight),
  })),
});
export const toListItem = (b: Brief): ReportListItem => ({
  id: b.id,
  kind: b.kind,
  title: b.title,
  period: b.period,
  generatedAt: b.generatedAt,
});
