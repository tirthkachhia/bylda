import { invokeEdge } from "@/lib/invokeEdge";
import { onboardingResponseQuery } from "@/lib/queries";
import { NotBuiltError } from "../core/errors";
import type { AnalysisProgressRow } from "./map";

const run = async <T>(q: { queryKey: readonly unknown[]; queryFn?: unknown }): Promise<T> =>
  (q.queryFn as (ctx: unknown) => Promise<T>)({
    queryKey: q.queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  });

/** REAL — existing wrapper over onboarding_responses. */
export const fetchOnboardingResponse = (orgId: string) =>
  run<{ business_name: string | null; completed: boolean | null } | null>(
    onboardingResponseQuery(orgId),
  );

/** REAL — complete-onboarding edge fn {mode, answers}. */
export const completeOnboarding = (answers: Record<string, unknown>) =>
  invokeEdge("complete-onboarding", { mode: "bylda_v1", answers });

/** C-19 · get_workspace_analysis_progress RPC */
export async function fetchAnalysisProgress(): Promise<AnalysisProgressRow> {
  throw new NotBuiltError("get_workspace_analysis_progress");
}
