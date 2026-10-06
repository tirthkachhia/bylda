import { NotBuiltError } from "../core/errors";
import type { BriefRow } from "./map";

/** C-17 · briefs */
export async function fetchBriefs(): Promise<BriefRow[]> {
  throw new NotBuiltError("briefs");
}
