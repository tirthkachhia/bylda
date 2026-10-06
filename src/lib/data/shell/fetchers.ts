import { NotBuiltError } from "../core/errors";

/** Rooms / DMs / saved items have no backend (GAPS 12). Real fetch = NOT_BUILT. */
export async function fetchSidebar(): Promise<never> {
  throw new NotBuiltError("rooms");
}
