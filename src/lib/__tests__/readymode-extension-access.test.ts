import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { handleReadyModeExtension } from "../../../supabase/functions/_shared/readymode-extension-handler";
import { importCall } from "../../../supabase/functions/_shared/import-call";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        ({
          SUPABASE_URL: "https://bylda.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "admin",
          SUPABASE_ANON_KEY: "anon",
        })[key],
    },
  });
});
const org = "a5f1b992-90cb-4bda-a989-000000000001",
  user = "a5f1b992-90cb-4bda-a989-000000000002";
function database({ member = true, token = true, expired = false, signedIn = true } = {}) {
  const writes: { table: string; operation: string; value?: Record<string, unknown> }[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: user } : null } }) },
    from: (table: string) => {
      let operation = "select";
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        insert: (value: Record<string, unknown>) => {
          operation = "insert";
          writes.push({ table, operation, value });
          return query;
        },
        upsert: (value: Record<string, unknown>) => {
          operation = "upsert";
          writes.push({ table, operation, value });
          return query;
        },
        delete: () => {
          operation = "delete";
          writes.push({ table, operation });
          return query;
        },
        maybeSingle: async () => ({
          data:
            table === "organization_members"
              ? member
                ? { organization_id: org }
                : null
              : table === "readymode_extension_connections"
                ? token
                  ? {
                      organization_id: org,
                      user_id: user,
                      expires_at: new Date(
                        Date.now() + (expired ? -1 : 1) * 86400000,
                      ).toISOString(),
                    }
                  : null
                : null,
          error: null,
        }),
        then: (resolve: (result: unknown) => void) => resolve({ data: null, error: null }),
      };
      return query;
    },
  };
  return {
    client,
    writes,
    factory: (() => client) as unknown as Parameters<typeof handleReadyModeExtension>[1],
  };
}
function request(action: string, token?: string) {
  return new Request("https://bylda.supabase.co/functions/v1/readymode-extension", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-bylda-connection": token } : { Authorization: "Bearer user-session" }),
    },
    body: JSON.stringify({ action, organization_id: org }),
  });
}
it("rejects unrecognized, expired and revoked import tokens before writing", async () => {
  for (const options of [{ token: false }, { expired: true }]) {
    const db = database(options);
    expect(
      (await handleReadyModeExtension(request("import", "a".repeat(64)), db.factory)).status,
    ).toBe(401);
    expect(db.writes).toHaveLength(0);
  }
});
it("stops tokens immediately when their owner loses membership", async () => {
  const db = database({ member: false });
  expect(
    (await handleReadyModeExtension(request("import", "a".repeat(64)), db.factory)).status,
  ).toBe(403);
  expect(db.writes).toHaveLength(0);
});
it("does not allow import tokens to mint or revoke connections", async () => {
  for (const action of ["connect", "disconnect", "status"]) {
    const db = database();
    expect(
      (await handleReadyModeExtension(request(action, "a".repeat(64)), db.factory)).status,
    ).toBe(403);
    expect(db.writes).toHaveLength(0);
  }
});
it("requires a signed-in workspace member to create a connection", async () => {
  const db = database({ signedIn: false });
  expect((await handleReadyModeExtension(request("connect"), db.factory)).status).toBe(401);
  expect(db.writes).toHaveLength(0);
});
it("stores only the hash and revokes by deleting the member's connection", async () => {
  const db = database();
  const response = await handleReadyModeExtension(request("connect"), db.factory);
  expect(response.status).toBe(200);
  const code = JSON.parse((await response.json()).connection_code);
  expect(code.token).toMatch(/^[a-f0-9]{64}$/);
  expect(db.writes[0].value).toMatchObject({ organization_id: org, user_id: user });
  expect(db.writes[0].value?.token_hash).not.toBe(code.token);
  expect(JSON.stringify(db.writes)).not.toContain(code.token);
  expect((await handleReadyModeExtension(request("disconnect"), db.factory)).status).toBe(200);
  expect(db.writes.at(-1)).toMatchObject({
    table: "readymode_extension_connections",
    operation: "delete",
  });
});
it("keeps manual transcript imports intact and assigns ReadyMode provenance only on the trusted path", async () => {
  const importId = "a5f1b992-90cb-4bda-a989-000000000003";
  for (const readyMode of [false, true]) {
    const db = database();
    const source = readyMode
      ? {
          provider: "readymode" as const,
          providerCallId: "team.readymode.com:42",
          host: "team.readymode.com",
          direction: "inbound" as const,
          duration: 91,
          startedAt: null,
          disposition: null,
          fromNumber: null,
          toNumber: null,
        }
      : undefined;
    const result = await importCall(
      db.client as unknown as Parameters<typeof importCall>[0],
      { id: user },
      { organization_id: org, import_id: importId, transcript: "Actual transcript", consent: true },
      source,
    );
    expect(result.status).toBe(200);
    expect((await result.json()).transcript_available).toBe(true);
    expect(db.writes.find((w) => w.table === "calls")?.value).toMatchObject({
      provider: readyMode ? "readymode" : "manual_upload",
      direction: readyMode ? "inbound" : "outbound",
      user_id: user,
      organization_id: org,
    });
    expect(db.writes.find((w) => w.table === "call_transcripts")?.value?.transcript_text).toBe(
      "Actual transcript",
    );
  }
});
