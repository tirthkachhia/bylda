import { NotBuiltError } from "../core/errors";
import type { AssignCoachingInput } from "../types";
import type { CoachingCommentRow, CoachingFocusRow } from "./map";

/** C-08 · coaching_focuses */
export async function fetchCoachingFoci(): Promise<CoachingFocusRow[]> {
  throw new NotBuiltError("coaching_focuses");
}
/** C-09 · coaching_comments */
export async function fetchCoachingComments(_focusId: string): Promise<CoachingCommentRow[]> {
  throw new NotBuiltError("coaching_comments");
}
/** C-08 · assign-coaching edge fn */
export async function postAssignCoaching(_input: AssignCoachingInput): Promise<CoachingFocusRow> {
  throw new NotBuiltError("assign-coaching");
}
/** C-08 · acknowledge-coaching edge fn */
export async function postAcknowledge(_focusId: string): Promise<CoachingFocusRow> {
  throw new NotBuiltError("acknowledge-coaching");
}
