import { NotBuiltError } from "../core/errors";
import type { OutcomeAssociationRow } from "./map";

/** C-14 · outcome_associations */
export async function fetchOutcomeAssociations(): Promise<OutcomeAssociationRow[]> {
  throw new NotBuiltError("outcome_associations");
}
