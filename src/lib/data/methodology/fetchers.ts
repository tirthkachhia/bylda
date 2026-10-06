import { NotBuiltError } from "../core/errors";
import type { MethodologyRow } from "./map";

/** C-20 · methodologies (+ stages, rules via behaviors, objection_library, success_criteria) */
export async function fetchMethodologies(): Promise<MethodologyRow[]> {
  throw new NotBuiltError("methodologies");
}
