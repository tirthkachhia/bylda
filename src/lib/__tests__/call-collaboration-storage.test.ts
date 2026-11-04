// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002",
  outsider = "20000000-0000-4000-8000-000000000003",
  call = "30000000-0000-4000-8000-000000000001",
  otherCall = "30000000-0000-4000-8000-000000000002",
  rep = "40000000-0000-4000-8000-000000000001",
  otherRep = "40000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create type public.org_role as enum ('owner','admin','member');create table auth.users(id uuid primary key);create table organizations(id uuid primary key);create table organization_members(organization_id uuid,user_id uuid,role public.org_role);
create function public.is_org_member(o uuid,u uuid) returns boolean language sql stable security definer as $$select exists(select 1 from organization_members where organization_id=o and user_id=u)$$;
create table calls(id uuid primary key,organization_id uuid,rep_id uuid);create table reps(id uuid primary key,organization_id uuid);create table coaching_analysis_runs(id uuid primary key,organization_id uuid,call_id uuid,rep_id uuid);
create table coaching_playbooks(id uuid primary key,organization_id uuid);create table coaching_reports(id uuid primary key,organization_id uuid,status text default 'completed');create table notifications(id uuid default gen_random_uuid(),user_id uuid,type text,message text);
create schema storage;create table storage.objects(bucket_id text,name text,metadata jsonb);
grant select on coaching_playbooks to authenticated;
grant usage on schema public,auth to authenticated;grant select on calls,reps,coaching_analysis_runs to authenticated;
insert into organizations values('${org}'),('${other}');insert into auth.users values('${owner}'),('${member}'),('${outsider}');insert into organization_members values('${org}','${owner}','owner'),('${org}','${member}','member'),('${other}','${outsider}','owner');insert into reps values('${rep}','${org}'),('${otherRep}','${other}');insert into calls values('${call}','${org}','${rep}'),('${otherCall}','${other}','${otherRep}');`);
  await db.exec(readFileSync("supabase/migrations/20261103000001_call_collaboration.sql", "utf8"));
  await db.exec(
    `alter table organizations add column owner_id uuid;update organizations set owner_id=case when id='${org}' then '${owner}'::uuid else '${outsider}'::uuid end;`,
  );
  for (const name of [
    "20261103000002_workspace_teams_rooms.sql",
    "20261103000003_report_schedules.sql",
    "20261103000004_workspace_preferences_audit.sql",
    "20261103000005_coaching_api_keys.sql",
    "20261103000006_coaching_data_controls.sql",
    "20261103000007_outcome_import.sql",
    "20261103000008_report_delivery.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function as(user: string) {
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${user}'`);
}
describe.sequential("call collaboration authorization", () => {
  it("imports attributed outcomes atomically and deduplicates identical CSV rows", async () => {
    await as(owner);
    const rows = [
      {
        call_id: call,
        outcome: "application_completed",
        occurred_at: "2026-11-02T12:00:00Z",
        source_reference: "Application system",
      },
    ];
    expect(
      (
        await db.query<{ n: number }>("select import_coaching_outcomes($1,$2::jsonb) as n", [
          org,
          JSON.stringify(rows),
        ])
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query<{ n: number }>("select import_coaching_outcomes($1,$2::jsonb) as n", [
          org,
          JSON.stringify(rows),
        ])
      ).rows[0].n,
    ).toBe(0);
    await expect(
      db.query("select import_coaching_outcomes($1,$2::jsonb)", [
        org,
        JSON.stringify([...rows, { ...rows[0], call_id: otherCall, outcome: "placed" }]),
      ]),
    ).rejects.toThrow("outside this workspace");
    expect((await db.query("select * from coaching_recorded_outcomes")).rows).toHaveLength(1);
    await as(member);
    await expect(
      db.query("select import_coaching_outcomes($1,$2::jsonb)", [org, JSON.stringify(rows)]),
    ).rejects.toThrow("Manager access");
  });
  it("computes storage usage without exposing another workspace's objects", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into storage.objects values('call-audio',$1,'{\"size\":1024}'),('call-audio',$2,'{\"size\":8192}')",
      [`${org}/user/one.mp3`, `${other}/user/two.mp3`],
    );
    await as(member);
    const usage = (
      await db.query<{ value: { storage_bytes: number } }>(
        "select coaching_usage_stats($1) as value",
        [org],
      )
    ).rows[0].value;
    expect(usage.storage_bytes).toBe(1024);
    await expect(db.query("select coaching_usage_stats($1)", [other])).rejects.toThrow(
      "Workspace access",
    );
    await expect(db.query("select * from coaching_storage_cleanup")).rejects.toThrow();
  });
  it("queues report delivery once and prevents members claiming delivery jobs", async () => {
    await db.exec("reset role");
    const report = "60000000-0000-4000-8000-000000000001";
    await db.query("insert into coaching_reports(id,organization_id) values($1,$2)", [report, org]);
    await db.query(
      "insert into coaching_delivery_channels(organization_id,kind,label,secret_ref,created_by) values($1,'slack','Coaching','encrypted-ref',$2)",
      [org, owner],
    );
    await db.query("select queue_coaching_report_delivery($1)", [report]);
    await db.query("select queue_coaching_report_delivery($1)", [report]);
    expect((await db.query("select * from coaching_report_deliveries")).rows).toHaveLength(1);
    await as(member);
    await expect(db.query("select * from claim_coaching_report_delivery()")).rejects.toThrow();
    await expect(db.query("select secret_ref from coaching_delivery_channels")).rejects.toThrow();
    await db.exec("reset role");
    expect((await db.query("select * from claim_coaching_report_delivery()")).rows).toHaveLength(1);
    expect((await db.query("select * from claim_coaching_report_delivery()")).rows).toHaveLength(0);
  });
  it("validates the production role enum and blocks cross-workspace team membership", async () => {
    await as(owner);
    await expect(
      db.query(
        "insert into coaching_teams(organization_id,name,rep_ids) values($1,'Wrong team',array[$2::uuid])",
        [org, otherRep],
      ),
    ).rejects.toThrow("Rep is outside");
    await db.query(
      "insert into coaching_teams(organization_id,name,rep_ids) values($1,'Sales',array[$2::uuid])",
      [org, rep],
    );
    await as(member);
    await expect(
      db.query("insert into coaching_teams(organization_id,name) values($1,'Unauthorized')", [org]),
    ).rejects.toThrow();
  });
  it("enforces private room visibility and message ownership", async () => {
    await as(owner);
    const room = (
      await db.query<{ id: string }>(
        "insert into coaching_rooms(organization_id,name,visibility) values($1,'Private review','private') returning id",
        [org],
      )
    ).rows[0];
    await db.query(
      "insert into coaching_room_messages(room_id,body) values($1,'Private coaching')",
      [room.id],
    );
    await as(member);
    expect((await db.query("select * from coaching_rooms")).rows).toHaveLength(0);
    expect((await db.query("select * from coaching_room_messages")).rows).toHaveLength(0);
    await expect(
      db.query("insert into coaching_room_messages(room_id,body) values($1,'Uninvited')", [
        room.id,
      ]),
    ).rejects.toThrow();
    await as(owner);
    await db.query("update coaching_rooms set member_ids=array[$1::uuid] where id=$2", [
      member,
      room.id,
    ]);
    await as(member);
    expect((await db.query("select * from coaching_room_messages")).rows).toHaveLength(1);
    expect(
      (await db.query("update coaching_room_messages set body='Overwrite' returning id")).rows,
    ).toHaveLength(0);
  });
  it("rejects room invitations to another workspace", async () => {
    await as(owner);
    await expect(
      db.query(
        "insert into coaching_rooms(organization_id,name,member_ids) values($1,'Leak',array[$2::uuid])",
        [org, outsider],
      ),
    ).rejects.toThrow("Room member is outside");
  });
  it("validates saved preferences and suppresses only the selected user's notification types", async () => {
    await as(owner);
    await db.query(
      "insert into coaching_workspace_preferences(organization_id,time_zone,confidence_floor) values($1,'America/New_York','high')",
      [org],
    );
    await expect(
      db.query("update coaching_workspace_preferences set time_zone='Invalid/Zone'"),
    ).rejects.toThrow();
    await as(member);
    expect(
      (
        await db.query(
          "update coaching_workspace_preferences set confidence_floor='medium' returning organization_id",
        )
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "insert into coaching_notification_preferences(muted_types) values(array['coaching_report'])",
    );
    await db.exec("reset role");
    await db.query(
      "insert into notifications(user_id,type,message) values($1,'coaching_report','Muted'),($2,'coaching_report','Visible')",
      [member, owner],
    );
    expect((await db.query("select * from notifications")).rows).toHaveLength(1);
  });
  it("keeps audit records immutable and avoids storing note bodies", async () => {
    await as(owner);
    const audit = await db.query("select * from coaching_audit_log");
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit.rows)).not.toContain("Private coaching");
    await expect(db.query("delete from coaching_audit_log")).rejects.toThrow();
  });
  it("does not expose API key hashes and immediately enforces revocation/rate limits", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into coaching_api_keys(organization_id,name,prefix,key_hash,created_by) values($1,'Export','bylda_test','test-hash',$2)",
      [org, owner],
    );
    await as(owner);
    await expect(db.query("select key_hash from coaching_api_keys")).rejects.toThrow();
    await db.exec("reset role");
    expect(
      (await db.query<{ org: string }>("select use_coaching_api_key('test-hash') as org")).rows[0]
        .org,
    ).toBe(org);
    await db.exec("update coaching_api_keys set request_count=120");
    await expect(db.query("select use_coaching_api_key('test-hash')")).rejects.toThrow(
      "rate limit",
    );
    await db.exec("update coaching_api_keys set revoked_at=now()");
    expect(
      (await db.query<{ org: null }>("select use_coaching_api_key('test-hash') as org")).rows[0]
        .org,
    ).toBeNull();
  });
  it("persists member notes and shares them only inside the workspace", async () => {
    await as(member);
    await db.query(
      "insert into coaching_call_notes(organization_id,call_id,body) values($1,$2,'Follow up on the agreed date')",
      [org, call],
    );
    expect(
      (await db.query("select body,author_id from coaching_call_notes")).rows[0],
    ).toMatchObject({ body: "Follow up on the agreed date", author_id: member });
    await as(owner);
    expect((await db.query("select * from coaching_call_notes")).rows).toHaveLength(1);
    await as(outsider);
    expect((await db.query("select * from coaching_call_notes")).rows).toHaveLength(0);
  });
  it("rejects cross-workspace calls and spoofed authors", async () => {
    await as(member);
    await expect(
      db.query(
        "insert into coaching_call_notes(organization_id,call_id,body) values($1,$2,'Wrong org')",
        [org, otherCall],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into coaching_call_notes(organization_id,call_id,author_id,body) values($1,$2,$3,'Spoof')",
        [org, call, owner],
      ),
    ).rejects.toThrow();
  });
  it("only lets the author edit/delete, and detects stale edit tokens", async () => {
    await as(owner);
    expect(
      (await db.query("update coaching_call_notes set body='Overwritten' returning id")).rows,
    ).toHaveLength(0);
    expect((await db.query("delete from coaching_call_notes returning id")).rows).toHaveLength(0);
    await as(member);
    const row = (
      await db.query<{ id: string; updated_at: Date }>(
        "select id,updated_at from coaching_call_notes",
      )
    ).rows[0];
    await db.query("update coaching_call_notes set body='Updated note' where id=$1", [row.id]);
    expect(
      (
        await db.query(
          "update coaching_call_notes set body='Stale writer' where id=$1 and updated_at=$2 returning id",
          [row.id, row.updated_at],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update coaching_call_notes set call_id=$1", [otherCall]),
    ).rejects.toThrow();
  });
  it("requires a manager and a matching rep/call to assign coaching", async () => {
    await as(member);
    await expect(
      db.query(
        "insert into coaching_assignments(organization_id,rep_id,call_id,focus,check_in_at) values($1,$2,$3,'Clarify application','2026-11-10')",
        [org, rep, call],
      ),
    ).rejects.toThrow();
    await as(owner);
    await expect(
      db.query(
        "insert into coaching_assignments(organization_id,rep_id,call_id,focus,check_in_at) values($1,$2,$3,'Wrong source','2026-11-10')",
        [org, rep, otherCall],
      ),
    ).rejects.toThrow();
    await db.query(
      "insert into coaching_assignments(organization_id,rep_id,call_id,focus,check_in_at) values($1,$2,$3,'Clarify application','2026-11-10')",
      [org, rep, call],
    );
  });
  it("saves check-ins and completion without allowing assignment ownership rewrites", async () => {
    await as(owner);
    await db.query(
      "update coaching_assignments set status='completed',check_in_note='Practiced a clear explanation'",
    );
    expect(
      (
        await db.query<{ status: string; completed_at: unknown }>(
          "select status,completed_at from coaching_assignments",
        )
      ).rows[0],
    ).toMatchObject({ status: "completed", completed_at: expect.anything() });
    await expect(
      db.query("update coaching_assignments set rep_id=$1", [otherRep]),
    ).rejects.toThrow();
    await as(member);
    expect(
      (await db.query("update coaching_assignments set status='cancelled' returning id")).rows,
    ).toHaveLength(0);
    await as(outsider);
    expect((await db.query("select * from coaching_assignments")).rows).toHaveLength(0);
  });
});
