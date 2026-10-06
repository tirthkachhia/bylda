import { useQuery } from "@tanstack/react-query";
import { useDataCtx } from "../session/hooks";
import type { DataCtx } from "./context";
import { withEmpty, type DataResult } from "./query";

/**
 * The one hook factory every domain uses: resolves the viewer's DataCtx, keys the
 * query by (domain key + who is asking), and adds `isEmpty`. Disabled until the
 * viewer loads, so a loader never runs without a ctx (rep scoping depends on it).
 */
export function useCtxQuery<T>(
  key: readonly unknown[],
  load: (ctx: DataCtx) => Promise<T>,
  isEmpty: (data: T) => boolean,
  opts: { enabled?: boolean; staleTime?: number } = {},
): DataResult<T> {
  const ctx = useDataCtx();
  const q = useQuery<T, Error>({
    queryKey: [...key, ctx?.userId ?? null, ctx?.role ?? null],
    queryFn: () => load(ctx as DataCtx),
    enabled: !!ctx && (opts.enabled ?? true),
    staleTime: opts.staleTime,
  });
  return withEmpty(q, isEmpty);
}
