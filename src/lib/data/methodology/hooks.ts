import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { METHODOLOGIES, OBJECTION_LIBRARY, SUCCESS_CRITERIA } from "../mocks/admin";
import type { Methodology, ObjectionLibraryItem, SuccessCriterion } from "../types";
import { fetchMethodologies } from "./fetchers";
import { mapMethodology } from "./map";
import { methodologyKeys } from "./queryKeys";
import { SOURCE } from "./source";

export async function loadMethodologies(ctx: DataCtx): Promise<Methodology[]> {
  void ctx;
  return resolveSource(SOURCE) === "mock"
    ? METHODOLOGIES
    : (await fetchMethodologies()).map(mapMethodology);
}
export async function loadMethodology(ctx: DataCtx, id: string): Promise<Methodology | null> {
  return (await loadMethodologies(ctx)).find((m) => m.id === id) ?? null;
}
// GAP: objection_library + success_criteria — C-20
export const loadObjectionLibrary = async (): Promise<ObjectionLibraryItem[]> => OBJECTION_LIBRARY;
export const loadSuccessCriteria = async (): Promise<SuccessCriterion[]> => SUCCESS_CRITERIA;

export const useMethodologies = () =>
  useCtxQuery(methodologyKeys.list(), loadMethodologies, isEmptyArray);
export const useMethodology = (id: string) =>
  useCtxQuery(
    methodologyKeys.one(id),
    (ctx) => loadMethodology(ctx, id),
    (d) => d === null,
  );
export const useObjectionLibrary = () =>
  useCtxQuery(methodologyKeys.objections(), loadObjectionLibrary, isEmptyArray);
export const useSuccessCriteria = () =>
  useCtxQuery(methodologyKeys.criteria(), loadSuccessCriteria, isEmptyArray);
