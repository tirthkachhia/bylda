import type { CallSourceTarget } from "./source-navigation";
export type CallReviewTab = "summary" | "transcript" | "analysis" | "methodology" | "scores";
export type CallsSearch = {
  view: "calls" | "report" | "playbooks" | "people" | "insights";
  repId?: string;
  callId?: string;
  runId?: string;
  turnId?: number;
  eventId?: string;
  at?: number;
  reportId?: string;
  tab?: CallReviewTab;
  sourceError?: string;
  q?: string;
  upload?: boolean;
};
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
export function readCallsSearch(input: Record<string, unknown>): CallsSearch {
  const view = ["calls", "report", "playbooks", "people", "insights"].includes(String(input.view))
    ? (input.view as CallsSearch["view"])
    : "calls";
  const result: CallsSearch = { view };
  if (input.upload === true || input.upload === "true") result.upload = true;
  for (const key of ["repId", "callId", "runId", "eventId", "reportId", "q"] as const) {
    const value = text(input[key]);
    if (value) result[key] = value;
  }
  for (const key of ["turnId", "at"] as const) {
    if (input[key] === undefined || input[key] === null) continue;
    const raw = input[key];
    const value =
      typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < 0 || (key === "turnId" && !Number.isSafeInteger(value)))
      result.sourceError = "Invalid source position.";
    else result[key] = value;
  }
  if ((result.runId || result.at !== undefined) && !result.callId)
    result.sourceError = "The source call is missing.";
  if ((result.turnId !== undefined || result.eventId) && !result.runId)
    result.sourceError = "The source analysis is missing.";
  if (["summary", "transcript", "analysis", "methodology", "scores"].includes(String(input.tab)))
    result.tab = input.tab as CallReviewTab;
  return result;
}
export function callsSearchFromSource(target: CallSourceTarget): CallsSearch {
  return {
    view: "calls",
    callId: target.callId,
    ...(target.repId ? { repId: target.repId } : {}),
    ...(target.startSeconds !== null ? { at: target.startSeconds } : {}),
    ...(target.source.kind === "behavior"
      ? {
          runId: target.source.runId,
          ...(target.source.turnId !== undefined ? { turnId: target.source.turnId } : {}),
          ...(target.source.eventId ? { eventId: target.source.eventId } : {}),
        }
      : {}),
    ...(target.source.kind === "report" ? { reportId: target.source.reportId } : {}),
    tab: "summary",
  };
}
