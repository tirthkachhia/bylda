import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { never } from "../core/query";
import { resolveSource } from "../core/source";
import { ONBOARDING } from "../mocks/admin";
import type { OnboardingState } from "../types";
import { completeOnboarding, fetchAnalysisProgress, fetchOnboardingResponse } from "./fetchers";
import { mapAnalysisProgress } from "./map";
import { onboardingKeys } from "./queryKeys";
import { SOURCE } from "./source";

/** A6–A11. */
export async function loadOnboarding(ctx: DataCtx): Promise<OnboardingState> {
  if (resolveSource(SOURCE) === "mock") return ONBOARDING;
  if (!ctx.orgId)
    return {
      step: "workspace",
      workspaceName: null,
      methodologyTemplate: null,
      connectedSources: [],
      invitedCount: 0,
      analysis: { analyzed: 0, total: 0, etaMinutes: null },
    };
  const [resp, progress] = await Promise.all([
    fetchOnboardingResponse(ctx.orgId),
    fetchAnalysisProgress().catch(() => null),
  ]);
  return {
    step: resp?.completed ? "done" : "workspace",
    workspaceName: resp?.business_name ?? null,
    // GAP: methodology template — C-20
    methodologyTemplate: null,
    connectedSources: [],
    invitedCount: 0,
    // GAP: workspace analysis progress — C-19
    analysis: progress
      ? mapAnalysisProgress(progress)
      : { analyzed: 0, total: 0, etaMinutes: null },
  };
}

export const useOnboarding = () => useCtxQuery(onboardingKeys.state(), loadOnboarding, never);

/** Save a step / finish (complete-onboarding). Mock resolves. */
export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: async (answers) =>
      resolveSource(SOURCE) === "mock" ? { ok: true } : completeOnboarding(answers),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.state() }),
  });
}
