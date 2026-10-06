import type { OnboardingState } from "../types";

/** C-19 · proposed get_workspace_analysis_progress row */
export type AnalysisProgressRow = {
  workspace_id: string;
  analyzed: number;
  total: number;
  eta_minutes: number | null;
  first_insight_ready: boolean;
};
export const mapAnalysisProgress = (r: AnalysisProgressRow): OnboardingState["analysis"] => ({
  analyzed: r.analyzed,
  total: r.total,
  etaMinutes: r.eta_minutes,
});
