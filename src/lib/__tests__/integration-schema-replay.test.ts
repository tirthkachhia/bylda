// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("replays the OAuth schema from squash columns without losing legacy credentials", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
    create table public.user_integrations(id uuid primary key default gen_random_uuid(),user_id uuid,integration_key text,status text,value_encrypted bytea,value_last4 text,created_at timestamptz,updated_at timestamptz,unique(user_id,integration_key));
    create view public.user_integrations_masked as select id,user_id,integration_key,status,value_last4,(value_encrypted is not null) as is_connected,created_at,updated_at from public.user_integrations;
    insert into public.user_integrations(integration_key,value_encrypted,value_last4) values('legacy',decode('010203','hex'),'1234');`);
    const migration = readFileSync(
      "supabase/migrations/20260612205959_integration_credential_columns.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(readFileSync("supabase/migrations/20260807000001_integration_oauth.sql", "utf8"));
    expect(
      (await db.query("select value_last4,is_connected from user_integrations_masked")).rows,
    ).toEqual([{ value_last4: "1234", is_connected: true }]);
    expect(
      (await db.query<{ encrypted_value: string }>("select encrypted_value from user_integrations"))
        .rows[0].encrypted_value,
    ).toBe("AQID");
    await db.exec("update user_integrations set encrypted_value='new-canonical',value_hint='5678'");
    await db.exec(migration);
    expect(
      (await db.query("select encrypted_value,value_hint from user_integrations")).rows,
    ).toEqual([{ encrypted_value: "new-canonical", value_hint: "5678" }]);
  } finally {
    await db.close();
  }
}, 30000);
