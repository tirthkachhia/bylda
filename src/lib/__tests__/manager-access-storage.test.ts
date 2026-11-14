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
    create table auth.mfa_factors(user_id uuid,status text);
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
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
    insert into calls values('${call}','${org}','${rep}','${agent}','{"audio_path":"${org}/${agent}/${call}.mp3"}'),('${otherCall}','${org}','${otherRep}','${otherAgent}','{"audio_path":"${org}/${otherAgent}/${otherCall}.mp3"}');
    insert into coaching_teams(id,organization_id,manager_id,name,rep_ids) values('${team}','${org}','${manager}','A',array['${rep}'::uuid]),('${otherTeam}','${org}','${otherManager}','B',array['${otherRep}'::uuid]);
    insert into storage.objects values('call-audio','${org}/${agent}/${call}.mp3'),('call-audio','${org}/${otherAgent}/${otherCall}.mp3');
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
  await db.exec(`
    create table memory_artifacts(id uuid primary key default gen_random_uuid(),org_id uuid,metadata jsonb,content text);
    create table context_memory_chunks(id uuid primary key default gen_random_uuid(),organization_id uuid,call_id uuid,transcript_id uuid,content text);
    create table coaching_delivery_channels(id uuid primary key,organization_id uuid,enabled boolean);
    create table coaching_report_deliveries(id uuid primary key default gen_random_uuid(),organization_id uuid,report_id uuid,channel_id uuid,unique(report_id,channel_id));
    alter table coaching_reports add column status text;
    create function queue_coaching_report_delivery(uuid) returns void language sql as $$
      insert into coaching_report_deliveries(organization_id,report_id,channel_id)
      select r.organization_id,r.id,c.id from coaching_reports r join coaching_delivery_channels c on c.organization_id=r.organization_id and c.enabled where r.id=$1 and r.status='completed' on conflict do nothing
    $$;
    insert into memory_artifacts(org_id,metadata,content) values('${org}','{"call_id":"${call}"}','My transcript'),('${org}','{"call_id":"${otherCall}"}','Private transcript');
    insert into context_memory_chunks(organization_id,call_id,content) values('${org}','${call}','My source'),('${org}','${otherCall}','Private source');
  `);
  for (const table of ["memory_artifacts", "context_memory_chunks", "coaching_report_deliveries"]) {
    await db.exec(
      `alter table ${table} enable row level security;create policy baseline on ${table} for all to authenticated using(true) with check(true);grant all on ${table} to authenticated,service_role;`,
    );
  }
  await db.exec(
    readFileSync("supabase/migrations/20261114000001_recording_evidence_access.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261114000002_transcription_claims.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/20261114000003_session_assurance.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261114000004_ask_history.sql", "utf8"));
  // Operators may need to replay a partially applied release: additive recovery
  // migrations preserve bindings and policies when run again.
  for (const migration of [
    "recording_evidence_access",
    "transcription_claims",
    "session_assurance",
    "ask_history",
  ]) {
    const number =
      [
        "recording_evidence_access",
        "transcription_claims",
        "session_assurance",
        "ask_history",
      ].indexOf(migration) + 1;
    await db.exec(
      readFileSync(`supabase/migrations/2026111400000${number}_${migration}.sql`, "utf8"),
    );
  }
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
  it("signs an owned upload before insertion, then binds it immutably", async () => {
    const fresh = id(60),
      path = `${org}/${agent}/${fresh}.mp3`;
    await as(agent, "service_role");
    await db.query("insert into storage.objects values('call-audio',$1)", [path]);
    await as(agent);
    expect(
      (await db.query("select * from storage.objects where name=$1", [path])).rows,
    ).toHaveLength(1);
    await db.query(
      "insert into calls(id,organization_id,rep_id,user_id,metadata) values($1,$2,$3,$4,$5)",
      [fresh, org, rep, agent, JSON.stringify({ audio_path: path })],
    );
    expect(
      (await db.query("select * from storage.objects where name=$1", [path])).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update calls set metadata=jsonb_build_object('audio_path',$1::text) where id=$2", [
        `${org}/${otherAgent}/${otherCall}.mp3`,
        fresh,
      ]),
    ).rejects.toThrow("immutable");
    await expect(
      db.query(
        "insert into calls(id,organization_id,rep_id,user_id,metadata) values($1,$2,$3,$4,$5)",
        [
          id(61),
          org,
          rep,
          agent,
          JSON.stringify({ audio_path: `${org}/${otherAgent}/${otherCall}.mp3` }),
        ],
      ),
    ).rejects.toThrow("Invalid recording");
    expect(
      (
        await db.query("select * from storage.objects where name=$1", [
          `${org}/${otherAgent}/${otherCall}.mp3`,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.query("delete from calls where id=$1", [fresh]);
    await as(agent, "service_role");
    await db.query("delete from storage.objects where name=$1", [path]);
  });
  it("scopes derived transcript copies and rejects invalid source identities", async () => {
    await as(agent);
    expect((await db.query("select * from memory_artifacts")).rows).toHaveLength(1);
    expect((await db.query("select * from context_memory_chunks")).rows).toHaveLength(1);
    await expect(
      db.query("insert into memory_artifacts(org_id,metadata,content) values($1,$2,'forged')", [
        org,
        '{"call_id":"invalid"}',
      ]),
    ).rejects.toThrow("row-level security");
  });
  it("reserves one transcription while allowing the original queue delivery to retry", async () => {
    const fresh = id(65),
      path = `${org}/${agent}/${fresh}.mp3`;
    await as(agent, "service_role");
    await db.query("insert into storage.objects values('call-audio',$1)", [path]);
    await db.query(
      "insert into calls(id,organization_id,rep_id,user_id,metadata) values($1,$2,$3,$4,$5)",
      [fresh, org, rep, agent, JSON.stringify({ audio_path: path })],
    );
    const claim = async (delivery: string) =>
      (
        await db.query<{ state: string }>(
          "select claim_coaching_transcription($1,$2,$3,$4,$5) as state",
          [fresh, org, agent, path, delivery],
        )
      ).rows[0].state;
    expect(await claim("delivery-a")).toBe("claimed");
    expect(await claim("delivery-b")).toBe("busy");
    expect(await claim("delivery-a")).toBe("claimed");
    await db.query("insert into call_transcripts(organization_id,call_id) values($1,$2)", [
      org,
      fresh,
    ]);
    expect(await claim("delivery-b")).toBe("saved");
    await expect(
      db.query("select claim_coaching_transcription($1,$2,$3,$4,'bad')", [
        fresh,
        otherOrg,
        agent,
        path,
      ]),
    ).rejects.toThrow("Invalid transcription source");
    await db.query("delete from call_transcripts where call_id=$1", [fresh]);
    await db.query("delete from calls where id=$1", [fresh]);
    await db.query("delete from storage.objects where name=$1", [path]);
  });
  it("makes report completion and delivery queuing one transaction", async () => {
    await db.exec("reset role");
    const report = id(70),
      channel = id(71);
    await db.query(
      "insert into coaching_reports(id,organization_id,rep_id,status) values($1,$2,$3,'running')",
      [report, org, rep],
    );
    await db.query("insert into coaching_delivery_channels values($1,$2,true)", [channel, org]);
    await db.exec(`create function fail_test_delivery() returns trigger language plpgsql as $$begin raise exception 'Queue unavailable';end$$;
      create trigger fail_test_delivery before insert on coaching_report_deliveries for each row execute function fail_test_delivery();`);
    await expect(
      db.query("update coaching_reports set status='completed' where id=$1", [report]),
    ).rejects.toThrow("Queue unavailable");
    expect(
      (
        await db.query<{ status: string }>("select status from coaching_reports where id=$1", [
          report,
        ])
      ).rows[0].status,
    ).toBe("running");
    await db.exec("drop trigger fail_test_delivery on coaching_report_deliveries");
    await db.query("update coaching_reports set status='completed' where id=$1", [report]);
    await db.query("update coaching_reports set status='completed' where id=$1", [report]);
    expect(
      (await db.query("select * from coaching_report_deliveries where report_id=$1", [report]))
        .rows,
    ).toHaveLength(1);
    await db.query("delete from coaching_report_deliveries where report_id=$1", [report]);
    await db.query("delete from coaching_reports where id=$1", [report]);
    await db.query("delete from coaching_delivery_channels where id=$1", [channel]);
  });
  it("enforces enrolled MFA on direct data and recording APIs", async () => {
    await db.exec("reset role");
    await db.query("insert into auth.mfa_factors values($1,'verified')", [agent]);
    await as(agent);
    expect((await db.query("select * from calls")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
    expect((await db.query("select * from memory_artifacts")).rows).toHaveLength(0);
    expect(
      (
        await db.query<{ allowed: boolean }>("select coaching_can_view_call($1,$2) as allowed", [
          org,
          call,
        ])
      ).rows[0].allowed,
    ).toBe(false);
    await db.exec("set request.jwt.claim.aal='aal2'");
    expect((await db.query("select * from calls")).rows).toHaveLength(1);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(1);
    await db.exec("reset role;set request.jwt.claim.aal='aal1'");
    await db.query("delete from auth.mfa_factors where user_id=$1", [agent]);
  });
  it("keeps saved Ask answers private and applies source-call visibility", async () => {
    await db.exec("reset role");
    for (const [viewer, source] of [
      [agent, call],
      [agent, otherCall],
      [manager, call],
    ]) {
      await db.query(
        "insert into coaching_ask_history(organization_id,user_id,scope_key,question,answer,citations,call_ids) values($1,$2,'calls::','What happened?','Answer','[]',array[$3::uuid])",
        [org, viewer, source],
      );
    }
    await as(agent);
    expect((await db.query("select * from coaching_ask_history")).rows).toHaveLength(1);
    await as(manager);
    expect((await db.query("select * from coaching_ask_history")).rows).toHaveLength(1);
    await as(otherAgent);
    expect((await db.query("select * from coaching_ask_history")).rows).toHaveLength(0);
    await as(owner);
    expect((await db.query("select * from coaching_ask_history")).rows).toHaveLength(0);
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
