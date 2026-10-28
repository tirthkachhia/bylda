// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const rep = "20000000-0000-4000-8000-000000000001",
  call = "30000000-0000-4000-8000-000000000001",
  transcript = "40000000-0000-4000-8000-000000000001";
const manager = "50000000-0000-4000-8000-000000000001",
  member = "50000000-0000-4000-8000-000000000002",
  outsider = "50000000-0000-4000-8000-000000000003";
let db: PGlite;
const transcriptHash = createHash("sha256").update("evidence").digest("hex");
const payload = (id: string, family = "objection_resolution") => ({
  summary: id,
  behavior_archive: {
    id,
    rep_id: rep,
    behavior_attempt_id: "fixture-attempt",
    started_at: "2026-10-27T12:00:00Z",
    structured_snapshot: null,
    source_text_snapshot: "evidence",
    prompt_version: "test-v1",
    models: ["fixture"],
    analysis: {
      version: "behavior-v1",
      coverage: { complete: true },
      events: [
        {
          occurrence_key: "objection:1",
          family,
          opportunity: "eligible",
          result: "strength",
          rep_evidence: [
            { turn_id: 1, speaker: "rep", text: "A useful clarification", start_s: 5, end_s: 6 },
          ],
          buyer_evidence: [{ turn_id: 2, speaker: "customer", text: "Yes", start_s: 7, end_s: 8 }],
          context_evidence: [],
        },
      ],
    },
  },
});
const save = (id: string, family?: string, hash = transcriptHash) =>
  db.query<{ saved: boolean }>(
    "select public.complete_call_analysis(null,null,$1,$2,$3,$4,$5::jsonb) as saved",
    [org, call, transcript, hash, JSON.stringify(payload(id, family))],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.organizations(id uuid primary key);
    create table public.reps(id uuid primary key);
    create table public.organization_members(organization_id uuid, user_id uuid, role text);
    create function public.is_org_member(o uuid,u uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.organization_members where organization_id=o and user_id=u)$$;
    create table public.calls(id uuid primary key, organization_id uuid, rep_id uuid, started_at timestamptz, created_at timestamptz default now(),metadata jsonb default '{}');
    create table public.call_transcripts(id uuid primary key,call_id uuid,organization_id uuid,transcript_text text,structured_turns jsonb,sentiment_score numeric);
    create function extensions.digest(value text, algorithm text) returns bytea language sql immutable as $$select sha256(convert_to(value,'UTF8'))$$;
    create table public.call_analysis_jobs(id uuid primary key,attempt_token uuid,organization_id uuid,call_id uuid,transcript_id uuid,transcript_hash text,analysis_version integer,status text,error_message text,completed_at timestamptz,lease_expires_at timestamptz);
    create table public.coaching_playbook_versions(id uuid primary key);
    create table public.call_guideline_adherence(status text constraint call_guideline_adherence_status_check check(status in ('followed','partial','missed','not_applicable')));
    create table public.call_insights(call_id uuid primary key,organization_id uuid,objections jsonb,competitor_mentions jsonb,talk_ratio numeric,next_steps_extracted jsonb,summary text,sales_profile text,vertical_insights jsonb,crm_writeback_preview jsonb,missing_required_fields text[],analysis_version integer,context_receipt jsonb,context_version bigint,transcript_hash text,writeback_status text,approved_at timestamptz,approved_by uuid);
    create table public.mentor_insights(org_id uuid,agent_id text,type text,title text,detail text,priority text,n8n_run_id text);
    create table public.coaching_reports(id uuid primary key,organization_id uuid,report jsonb,delivered_at timestamptz);
    grant usage on schema public,auth to authenticated;
    grant select on public.organization_members to authenticated;
    grant select,update on public.coaching_reports to authenticated;
    alter table public.coaching_reports enable row level security;
    create policy reports_read on public.coaching_reports for select to authenticated using(public.is_org_member(organization_id,auth.uid()));
    insert into organizations values('${org}'),('${other}'); insert into reps values('${rep}');
    insert into auth.users values('${manager}'),('${member}'),('${outsider}');
    insert into organization_members values('${org}','${manager}','owner'),('${org}','${member}','member'),('${other}','${outsider}','owner');
    insert into calls values('${call}','${org}','${rep}','2026-09-01T00:00:00Z',now(),'{"behavior_attempt_id":"fixture-attempt","coaching_stage":"analyzing"}');
    insert into call_transcripts values('${transcript}','${call}','${org}','evidence',null,null);
    insert into coaching_reports values('${call}','${org}','{"original":true}',null);`);
  const baseline = readFileSync(
    "supabase/migrations/20260813000001_context_memory_mvp.sql",
    "utf8",
  );
  const start = baseline.indexOf("create or replace function public.complete_call_analysis(");
  const end = baseline.indexOf("-- Context freshness and observability.", start);
  await db.exec(baseline.slice(start, end));
  await db.exec(
    readFileSync("supabase/migrations/20261027000001_behavior_intelligence.sql", "utf8"),
  );
}, 30_000);
afterAll(async () => {
  await db?.close();
});

describe.sequential("behavior persistence and authorization", () => {
  it("stores source evidence, rep identity and actual call time atomically", async () => {
    await save("60000000-0000-4000-8000-000000000001");
    const result = await db.query<{ rep_id: string; start_s: string }>(
      "select rep_id,start_s from coaching_behavior_events",
    );
    expect(result.rows[0].rep_id).toBe(rep);
    expect(Number(result.rows[0].start_s)).toBe(5);
    expect(
      (await db.query<{ metadata: { coaching_stage: string } }>("select metadata from calls"))
        .rows[0].metadata.coaching_stage,
    ).toBe("analyzed");
    const run = await db.query<{ date: string }>(
      "select call_occurred_at::date::text as date from coaching_analysis_runs",
    );
    expect(run.rows[0].date).toBe("2026-09-01");
  });
  it("preserves prior runs and events when a call is analyzed again", async () => {
    await save("60000000-0000-4000-8000-000000000002");
    expect((await db.query("select * from coaching_analysis_runs")).rows).toHaveLength(2);
    expect((await db.query("select * from coaching_behavior_events")).rows).toHaveLength(2);
  });
  it("rejects stale transcripts and rolls back the current projection if archiving fails", async () => {
    const stale = await save("60000000-0000-4000-8000-000000000003", undefined, "stale");
    expect(stale.rows[0].saved).toBe(false);
    await expect(save("60000000-0000-4000-8000-000000000003", "invented_family")).rejects.toThrow();
    const projection = await db.query<{ summary: string }>("select summary from call_insights");
    expect(projection.rows[0].summary).toBe("60000000-0000-4000-8000-000000000002");
    expect((await db.query("select * from coaching_analysis_runs")).rows).toHaveLength(2);
  });
  it("does not expose another organization's events", async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${outsider}'`);
    expect((await db.query("select * from coaching_behavior_events")).rows).toHaveLength(0);
    await db.exec("reset role");
  });
  it("accepts append-only manager feedback but rejects member feedback and report rewrites", async () => {
    const id = (await db.query<{ id: string }>("select id from coaching_behavior_events limit 1"))
      .rows[0].id;
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${member}'`);
    await expect(
      db.query(
        "insert into coaching_behavior_feedback(event_id,accuracy,usefulness) values($1,'accurate','useful')",
        [id],
      ),
    ).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${manager}'`);
    await db.query(
      "insert into coaching_behavior_feedback(event_id,accuracy,usefulness,correction) values($1,'incorrect','unhelpful','Wrong interpretation')",
      [id],
    );
    await expect(
      db.query("update coaching_behavior_feedback set accuracy='accurate'"),
    ).rejects.toThrow();
    await expect(db.query("update coaching_reports set report='{}'")).rejects.toThrow();
    await db.exec("update coaching_reports set delivered_at=now(); reset role");
    expect((await db.query("select * from coaching_behavior_feedback")).rows).toHaveLength(1);
  });
  it("retrieves only accurate AND useful reviewed examples and withholds disputed labels", async () => {
    expect((await db.query("select * from coaching_reviewed_examples")).rows).toHaveLength(0);
    const id = (
      await db.query<{ id: string }>(
        "select event_id as id from coaching_behavior_feedback limit 1",
      )
    ).rows[0].id;
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${manager}'`);
    await db.query(
      "insert into coaching_behavior_feedback(event_id,accuracy,usefulness) values($1,'accurate','unhelpful')",
      [id],
    );
    await db.exec("reset role");
    expect((await db.query("select * from coaching_reviewed_examples")).rows).toHaveLength(0);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${manager}'`);
    await db.query(
      "insert into coaching_behavior_feedback(event_id,accuracy,usefulness) values($1,'accurate','useful')",
      [id],
    );
    await db.exec("reset role");
    expect((await db.query("select * from coaching_reviewed_examples")).rows).toHaveLength(1);
    const second = "50000000-0000-4000-8000-000000000004";
    await db.exec(
      `insert into auth.users values('${second}'); insert into organization_members values('${org}','${second}','admin'); set role authenticated; set request.jwt.claim.sub='${second}'`,
    );
    await db.query(
      "insert into coaching_behavior_feedback(event_id,accuracy,usefulness) values($1,'incorrect','useful')",
      [id],
    );
    await db.exec("reset role");
    expect((await db.query("select * from coaching_reviewed_examples")).rows).toHaveLength(0);
  });
  it("requires manager approval for immutable policy versions and blocks client analysis writes", async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${member}'`);
    await expect(
      db.query(
        "insert into coaching_policy_versions(organization_id,title,version,content) values($1,'Approved claims',1,'Do not promise approval.')",
        [org],
      ),
    ).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${manager}'`);
    await db.query(
      "insert into coaching_policy_versions(organization_id,title,version,content) values($1,'Approved claims',1,'Do not promise approval.')",
      [org],
    );
    await expect(
      db.query("update coaching_policy_versions set content='Changed policy'"),
    ).rejects.toThrow();
    await expect(
      db.query("update coaching_analysis_runs set prompt_version='forged'"),
    ).rejects.toThrow();
    await expect(save("60000000-0000-4000-8000-000000000099")).rejects.toThrow();
    await db.exec("reset role");
  });
  it("rejects structured-transcript changes even if flattened text did not change", async () => {
    await db.exec(
      `update call_transcripts set structured_turns='[{"text":"changed speaker attribution"}]'`,
    );
    expect((await save("60000000-0000-4000-8000-000000000004")).rows[0].saved).toBe(false);
    await db.exec("update call_transcripts set structured_turns=null");
    expect((await db.query("select * from coaching_analysis_runs")).rows).toHaveLength(2);
  });
});
