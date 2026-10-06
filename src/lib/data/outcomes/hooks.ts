import { assertNotRep, type DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { OUTCOMES } from "../mocks/intelligence";
import type { OutcomeAssociation } from "../types";
import { fetchOutcomeAssociations } from "./fetchers";
import { mapOutcomeAssociation } from "./map";
import { outcomeKeys } from "./queryKeys";
import { SOURCE } from "./source";

/**
 * I2/I5/I6/I9. Returns every association INCLUDING n_closed < 30 ones — the screen
 * must render Y3 (systemStates.insufficientData) for those: use isOutcomeSufficient().
 */
export async function loadOutcomeAssociations(
  ctx: DataCtx,
  behaviorKey?: string,
): Promise<OutcomeAssociation[]> {
  assertNotRep(ctx, "outcome associations");
  const rows =
    resolveSource(SOURCE) === "mock"
      ? OUTCOMES
      : (await fetchOutcomeAssociations()).map(mapOutcomeAssociation);
  return rows.filter((r) => !behaviorKey || r.behaviorKey === behaviorKey);
}

export const useOutcomeAssociations = (behaviorKey?: string) =>
  useCtxQuery(
    outcomeKeys.list(behaviorKey),
    (ctx) => loadOutcomeAssociations(ctx, behaviorKey),
    isEmptyArray,
  );
