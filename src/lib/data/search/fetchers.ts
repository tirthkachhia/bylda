import { NotBuiltError } from "../core/errors";
import type { SearchResponseRow } from "./map";

/** C-21 · search-calls edge fn: question → filters → results. Never answers from memory. */
export async function postSearchCalls(_input: {
  query: string;
  window_days: number;
}): Promise<SearchResponseRow> {
  throw new NotBuiltError("search-calls");
}
