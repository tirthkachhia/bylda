import type { UseQueryResult } from "@tanstack/react-query";

/** Every hook returns TanStack Query's result plus `isEmpty`, so page-17 states compose. */
export type DataResult<T> = UseQueryResult<T, Error> & { isEmpty: boolean };

export function withEmpty<T>(
  q: UseQueryResult<T, Error>,
  isEmpty: (d: T) => boolean,
): DataResult<T> {
  return Object.assign(q, { isEmpty: q.data !== undefined && isEmpty(q.data) });
}

export const isEmptyArray = <T>(d: T[]) => d.length === 0;
export const never = () => false;
