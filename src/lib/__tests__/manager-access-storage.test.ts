// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1),
  otherOrg = id(2),
  owner = id(10),
  manager = id(11),
  otherManager = id(12),
  agent = id(13),
  otherAgent = id(14),
  outsider = id(15);
const rep = id(20),
  otherRep = id(21),
  call = id(30),
  otherCall = id(31),
  team = id(40),
  otherTeam = id(41);
const callTables = [
  "call_transcripts",
  "call_insights",
  "call_exchange_scores",
  "call_score_summaries",
  "call_learning_moments",
  "call_guideline_adherence",
  "coaching_analysis_runs",
  "coaching_behavior_events",
  "coaching_call_notes",
  "coaching_recorded_outcomes",
];
const repTables = ["coaching_reports", "coaching_assignments", "coaching_report_schedules"];
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create type public.org_role as enum ('owner','admin','member');
    create table auth.users(id uuid primary key);
    create table public.organizations(id uuid primary key,owner_id uuid);
    create table public.profiles(id uuid primary key,email text);
    create table public.organization_members(organization_id uuid,user_id uuid,role public.org_role,primary key(organization_id,user_id));
    create function public.is_org_member(o uuid,u uuid) returns boolean language sql stable security definer as $$select exists(select 1 from organization_members where organization_id=o and user_id=u)$$;
    create function public.is_org_admin(o uuid,u uuid) returns boolean language sql stable security definer as $$select exists(select 1 from organization_members where organization_id=o and user_id=u and role::text in ('owner','admin'))$$;
    create function public.coaching_is_manager(o uuid) returns boolean language sql stable security definer as $$select exists(select 1 from organization_members where organization_id=o and user_id=auth.uid() and role::text in ('owner','admin','manager'))$$;
    create table public.reps(id uuid primary key default gen_random_uuid(),organization_id uuid,created_by uuid,name text,email text,status text default 'active');
    create table public.calls(id uuid primary key,organization_id uuid,rep_id uuid,user_id uuid,metadata jsonb);
    create table public.coaching_teams(id uuid primary key,organization_id uuid,manager_id uuid,name text,rep_ids uuid[] default '{}',playbook_id uuid,updated_at timestamptz default now());
    create table public.coaching_playbooks(id uuid primary key,organization_id uuid);
    create table storage.objects(bucket_id text,name text);
    insert into auth.users values('${owner}'),('${manager}'),('${otherManager}'),('${agent}'),('${otherAgent}'),('${outsider}');
    insert into organizations values('${org}','${owner}'),('${otherOrg}','${outsider}');
    insert into organization_members values('${org}','${owner}','owner'),('${org}','${agent}','member'),('${org}','${otherAgent}','member'),('${otherOrg}','${outsider}','owner');
    insert into profiles values('${agent}','agent@example.com'),('${otherAgent}','other@example.com');
    insert into reps(id,organization_id,created_by,name,email) values('${rep}','${org}','${manager}','Agent','agent@example.com'),('${otherRep}','${org}','${otherManager}','Other','other@example.com');
    insert into calls values('${call}','${org}','${rep}','${agent}','{"audio_path":"a.mp3"}'),('${otherCall}','${org}','${otherRep}','${otherAgent}','{"audio_path":"b.mp3"}');
    insert into coaching_teams(id,organization_id,manager_id,name,rep_ids) values('${team}','${org}','${manager}','A',array['${rep}'::uuid]),('${otherTeam}','${org}','${otherManager}','B',array['${otherRep}'::uuid]);
    insert into storage.objects values('call-audio','a.mp3'),('call-audio','b.mp3');
    grant usage on schema public,auth,storage to authenticated,service_role;
    grant select on organizations to authenticated;
    grant insert on auth.users to service_role;
  `);
  for (const table of callTables)
    await db.exec(
      `create table public.${table}(id uuid primary key default gen_random_uuid(),organization_id uuid,call_id uuid);insert into ${table}(organization_id,call_id) values('${org}','${call}'),('${org}','${otherCall}');`,
    );
  for (const table of repTables)
    await db.exec(
      `create table public.${table}(id uuid primary key default gen_random_uuid(),organization_id uuid,rep_id uuid);insert into ${table}(organization_id,rep_id) values('${org}','${rep}'),('${org}','${otherRep}');`,
    );
  // Deliberately broad baseline policies ensure the migration actually narrows
  // the existing policies rather than merely adding another permissive policy.
  for (const table of [
    "organization_members",
    "reps",
    "calls",
    "coaching_teams",
    ...callTables,
    ...repTables,
    "storage.objects",
  ]) {
    await db.exec(
      `alter table ${table} enable row level security;create policy baseline on ${table} for all to authenticated using(true) with check(true);grant all on ${table} to authenticated,service_role;`,
    );
  }
  await db.exec(readFileSync("supabase/migrations/20261111000001_manager_role.sql", "utf8"));
  await db.exec(
    `insert into organization_members values('${org}','${manager}','manager'),('${org}','${otherManager}','manager');`,
  );
  await db.exec(readFileSync("supabase/migrations/20261111000002_manager_access.sql", "utf8"));
  await db.exec(
    "create trigger coaching_team_valid before insert or update on public.coaching_teams for each row execute function public.validate_coaching_team()",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function as(user: string, role = "authenticated") {
  await db.exec(`reset role;set role ${role};set request.jwt.claim.sub='${user}'`);
}

describe.sequential("manager and agent database boundaries", () => {
  it("backfills explicit agent login identities", async () => {
    await as(owner);
    expect(
      (await db.query<{ user_id: string }>("select user_id from reps where id=$1", [rep])).rows[0]
        .user_id,
    ).toBe(agent);
  });
  it.each([manager, agent])(
    "limits %s to assigned calls and every dependent artifact",
    async (user) => {
      await as(user);
      expect((await db.query("select * from reps")).rows).toHaveLength(1);
      expect((await db.query("select * from calls")).rows).toHaveLength(1);
      for (const table of [...callTables, ...repTables])
        expect((await db.query(`select * from ${table}`)).rows, table).toHaveLength(1);
      expect((await db.query("select * from storage.objects")).rows).toHaveLength(1);
      expect((await db.query("select * from calls where id=$1", [otherCall])).rows).toHaveLength(0);
    },
  );
  it("keeps workspace owner visibility and blocks outsiders", async () => {
    await as(owner);
    expect((await db.query("select * from calls")).rows).toHaveLength(2);
    await as(outsider);
    expect((await db.query("select * from calls")).rows).toHaveLength(0);
  });
  it("prevents self-enrollment with a manager or owner role", async () => {
    await as(outsider);
    for (const role of ["manager", "owner"])
      await expect(
        db.query("insert into organization_members values($1,$2,$3)", [org, outsider, role]),
      ).rejects.toThrow("row-level security");
  });
  it("rejects claiming another manager's rep or assigning a member as manager", async () => {
    await as(manager);
    await expect(
      db.query("update coaching_teams set rep_ids=array[$1::uuid,$2::uuid] where id=$3", [
        rep,
        otherRep,
        team,
      ]),
    ).rejects.toThrow(/outside this workspace|another manager/);
    await as(owner);
    await expect(
      db.query("update coaching_teams set manager_id=$1 where id=$2", [agent, team]),
    ).rejects.toThrow("workspace manager");
  });
  it("blocks direct agent identity changes and member rep creation", async () => {
    await as(manager);
    await expect(
      db.query("update reps set user_id=$1 where id=$2", [otherAgent, rep]),
    ).rejects.toThrow("invite service");
    await as(agent);
    await expect(
      db.query("insert into reps(organization_id,created_by,name) values($1,$2,'Fake')", [
        org,
        agent,
      ]),
    ).rejects.toThrow("row-level security");
  });
  it("reserves agent attachment for the service role and validates the calling manager", async () => {
    await as(manager);
    await expect(
      db.query("select attach_coaching_agent($1,$2,$3,$4,'Agent','agent@example.com')", [
        org,
        agent,
        manager,
        team,
      ]),
    ).rejects.toThrow("permission denied");
    await as(manager, "service_role");
    await expect(
      db.query("select attach_coaching_agent($1,$2,$3,$4,'Other','other@example.com')", [
        org,
        otherAgent,
        manager,
        team,
      ]),
    ).rejects.toThrow("another manager");
    await expect(
      db.query("select attach_coaching_agent($1,$2,$3,$4,'Agent','agent@example.com')", [
        org,
        agent,
        manager,
        otherTeam,
      ]),
    ).rejects.toThrow("team you manage");
    await expect(
      db.query("select attach_coaching_agent($1,$2,$3,$4,'Agent','agent@example.com')", [
        org,
        agent,
        agent,
        team,
      ]),
    ).rejects.toThrow("Manager access");
  });
  it("attaches an existing agent idempotently without duplicate team entries", async () => {
    await as(manager, "service_role");
    for (let i = 0; i < 2; i++)
      expect(
        (
          await db.query<{ rep: string }>(
            "select attach_coaching_agent($1,$2,$3,$4,'Agent','agent@example.com') as rep",
            [org, agent, manager, team],
          )
        ).rows[0].rep,
      ).toBe(rep);
    await as(manager);
    expect(
      (
        await db.query<{ rep_ids: string[] }>("select rep_ids from coaching_teams where id=$1", [
          team,
        ])
      ).rows[0].rep_ids,
    ).toEqual([rep]);
  });
  it("creates membership, login link and team assignment in one transaction", async () => {
    await as(manager, "service_role");
    const newAgent = id(16);
    await db.query("insert into auth.users values($1)", [newAgent]);
    const result = await db.query<{ rep: string }>(
      "select attach_coaching_agent($1,$2,$3,$4,'New agent','new@example.com') as rep",
      [org, newAgent, manager, team],
    );
    await as(newAgent);
    expect((await db.query<{ id: string }>("select id from reps")).rows.map((r) => r.id)).toEqual([
      result.rows[0].rep,
    ]);
    expect((await db.query("select * from calls")).rows).toHaveLength(0);
  });
  it("revokes the original creator's access when an owner transfers the agent", async () => {
    await as(owner);
    await db.query("update coaching_teams set rep_ids=array_remove(rep_ids,$1) where id=$2", [
      rep,
      team,
    ]);
    await db.query("update coaching_teams set rep_ids=array_append(rep_ids,$1) where id=$2", [
      rep,
      otherTeam,
    ]);
    await as(manager);
    expect((await db.query("select * from calls where id=$1", [call])).rows).toHaveLength(0);
    expect((await db.query("delete from reps where id=$1 returning id", [rep])).rows).toHaveLength(
      0,
    );
    await as(otherManager);
    expect((await db.query("select * from calls where id=$1", [call])).rows).toHaveLength(1);
  });
});
