import { z } from "zod";
import type { DataCtx } from "../core/context";

/**
 * A backend CONTRACT: what the frontend already consumes and what the backend must
 * build to serve it. The backend is built FROM these (BACKEND_BACKLOG.md is generated
 * from them — `bun run contracts:doc`). Every contract has a Vitest contract test in
 * src/lib/data/__tests__/contracts/ that fails the moment the real rows stop matching.
 */
export type PgType =
  | "uuid"
  | "text"
  | "int"
  | "numeric"
  | "bool"
  | "timestamptz"
  | "date"
  | "jsonb"
  | "text[]"
  | "uuid[]"
  | { enum: readonly string[] };

export type Column = { name: string; type: PgType; nullable?: boolean; fk?: string; note?: string };

export type TableSpec = {
  name: string;
  /** "new" = create it · "alter" = add these columns to an existing table */
  change: "new" | "alter" | "view";
  columns: Column[];
  rls: string;
  notes?: string;
};

export type Endpoint = {
  kind: "postgrest" | "rpc" | "edge" | "derived";
  name: string;
  input: string;
  output: string;
  auth: string;
};

export type ContractStatus = "Not started" | "In progress" | "Done" | "Derived — no backend";

export type Contract<
  Row extends Record<string, unknown> = Record<string, unknown>,
  VM = unknown,
> = {
  id: string;
  order: number;
  title: string;
  /** Demo flow(s) it unblocks, e.g. "Flow 1 · Manager day" */
  flows: string[];
  /** Figma screen codes that consume it */
  screens: string[];
  /** GAPS.md items it closes (area + field) */
  gaps: string[];
  /** The view model screens use (type name + file under src/lib/data/types) */
  viewModel: { type: string; file: string };
  domain: string;
  /** The row the proposed table returns. Null for derived contracts. */
  table: TableSpec | null;
  extraTables?: TableSpec[];
  endpoints: Endpoint[];
  status: ContractStatus;
  /** A proposed row, exactly as the backend should return it. */
  example: Row | null;
  /** The mapper the data layer uses: proposed row → view model. */
  map: ((row: Row) => VM) | null;
  /** What the screens get today in mock mode. */
  mock: () => VM;
  /** The real read. Throws NOT_BUILT until the backend lands. */
  fetchReal: ((ctx: DataCtx) => Promise<Row[]>) | null;
};

/** Build a zod schema for a table's rows from its column spec (the executable contract). */
export function rowSchema(table: TableSpec) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const c of table.columns) {
    let t: z.ZodTypeAny;
    const ty = c.type;
    if (typeof ty === "object") t = z.enum(ty.enum as [string, ...string[]]);
    else if (ty === "int" || ty === "numeric") t = z.number();
    else if (ty === "bool") t = z.boolean();
    else if (ty === "jsonb") t = z.any();
    else if (ty === "text[]" || ty === "uuid[]") t = z.array(z.string());
    else t = z.string();
    shape[c.name] = c.nullable ? t.nullable() : t;
  }
  return z.object(shape).strict();
}

/**
 * Structural signature of a value: object keys (sorted, recursive), primitive typeof,
 * arrays by their first element. Two view models "match" when their signatures are
 * equal — how a contract test proves mapper(proposed row) ≡ mock shape.
 */
export function shapeOf(v: unknown): unknown {
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0])] : ["empty"];
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, shapeOf(o[k])]),
    );
  }
  return typeof v;
}

/** Like shapeOf, but `null` and empty arrays are wildcards (nullable/optional-length fields). */
export function shapesCompatible(a: unknown, b: unknown): boolean {
  if (a === "null" || b === "null") return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a[0] === "empty" || b[0] === "empty") return true;
    return shapesCompatible(a[0], b[0]);
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      shapesCompatible((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return a === b;
}

/** Identity helper so each contract infers its Row / VM types. */
export function defineContract<Row extends Record<string, unknown>, VM>(
  c: Contract<Row, VM>,
): Contract<Row, VM> {
  return c;
}

export const RLS_ORG =
  "select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only";
export const RLS_ORG_REP =
  "select: is_org_member(organization_id, auth.uid()) AND (role <> 'rep' OR rep_id = auth.uid()) — reps read only their own rows";
