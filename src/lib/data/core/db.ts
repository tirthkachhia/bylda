import { supabase } from "@/integrations/supabase/client";

/**
 * The typed client doesn't know the 16+ tables missing from the stale types.ts
 * (CLAUDE.md §12 C). `untyped()` reaches them; every result is immediately cast to
 * a row type from ../db-types.ts. Delete this when Tirth regenerates types.ts.
 */
type Untyped = {
  from: (table: string) => {
    select: (cols?: string, opts?: Record<string, unknown>) => UntypedQuery;
  };
};
type UntypedQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}> & {
  eq: (col: string, v: unknown) => UntypedQuery;
  in: (col: string, v: unknown[]) => UntypedQuery;
  gte: (col: string, v: unknown) => UntypedQuery;
  order: (col: string, opts?: { ascending?: boolean }) => UntypedQuery;
  limit: (n: number) => UntypedQuery;
  maybeSingle: () => UntypedQuery;
};

export function untyped(): Untyped {
  return supabase as unknown as Untyped;
}

export { supabase };

/** Throw on a PostgREST error, return data otherwise. */
export function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
