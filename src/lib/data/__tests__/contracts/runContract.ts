import { beforeAll, describe, expect, it } from "vitest";
import type { DataCtx } from "../../core/context";
import { rowSchema, shapeOf, shapesCompatible, type Contract } from "../../contracts/types";

/**
 * The shared contract test. One file per contract calls it (C-01.contract.test.ts …).
 *
 * Offline (default, CI):
 *   1. the proposed example row satisfies the row schema built from the column spec
 *   2. mapper(proposed row) has exactly the shape of the mock view model screens use
 *   3. while status is "Not started", the real fetcher throws NOT_BUILT — so nobody can
 *      flip a domain's SOURCE to 'real' before the backend exists
 *
 * Live (when the backend lands): BYLDA_CONTRACT_LIVE=1 plus
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, BYLDA_CONTRACT_EMAIL,
 *   BYLDA_CONTRACT_PASSWORD, BYLDA_CONTRACT_ORG_ID
 *   → fetches real rows and validates EVERY row against the same schema + mapper shape.
 *   A contract is Done in BACKEND_BACKLOG.md only when its live test passes.
 */
const LIVE = process.env.BYLDA_CONTRACT_LIVE === "1";

const OFFLINE_CTX: DataCtx = {
  userId: "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "manager",
};

function liveCtx(userId: string): DataCtx {
  return {
    userId,
    orgId: process.env.BYLDA_CONTRACT_ORG_ID ?? null,
    workspaceId: null,
    teamId: null,
    role: "manager",
  };
}

export function runContract(c: Contract<Record<string, unknown>, unknown>) {
  describe(`${c.id} · ${c.title}`, () => {
    if (!c.table) {
      it("is derived client-side — no backend table", () => {
        expect(c.status).toBe("Derived — no backend");
        expect(c.fetchReal).toBeNull();
      });
      return;
    }

    const schema = rowSchema(c.table);

    it("proposed example row satisfies the row schema", () => {
      const r = schema.safeParse(c.example);
      expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
    });

    it("mapper(proposed row) ≡ mock view model shape", () => {
      const fromRow = shapeOf(c.map!(c.example!));
      const fromMock = shapeOf(c.mock());
      expect(
        shapesCompatible(fromRow, fromMock),
        `row → ${JSON.stringify(fromRow)}\nmock → ${JSON.stringify(fromMock)}`,
      ).toBe(true);
    });

    it("lists the screens and GAPS items it unblocks", () => {
      expect(c.screens.length).toBeGreaterThan(0);
      expect(c.gaps.length).toBeGreaterThan(0);
      expect(c.endpoints.length).toBeGreaterThan(0);
    });

    if (c.status === "Not started") {
      it("real fetcher reports NOT_BUILT until the backend lands", async () => {
        await expect(c.fetchReal!(OFFLINE_CTX)).rejects.toThrow(/NOT_BUILT/);
      });
    }

    describe.skipIf(!LIVE)("LIVE backend", () => {
      let ctx: DataCtx;
      beforeAll(async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.auth.signInWithPassword({
          email: process.env.BYLDA_CONTRACT_EMAIL ?? "",
          password: process.env.BYLDA_CONTRACT_PASSWORD ?? "",
        });
        if (error) throw error;
        ctx = liveCtx(data.user!.id);
      });
      it("every real row matches the contract", async () => {
        const rows = await c.fetchReal!(ctx);
        for (const row of rows) {
          const r = schema.safeParse(row);
          expect(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2)).toBe(true);
          expect(shapesCompatible(shapeOf(c.map!(row)), shapeOf(c.mock()))).toBe(true);
        }
      });
    });
  });
}
