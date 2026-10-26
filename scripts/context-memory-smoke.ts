import { createClient } from "@supabase/supabase-js";

function readLocalSupabaseEnv() {
  const result = Bun.spawnSync({
    cmd: [process.execPath, "x", "supabase", "status", "-o", "env"],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Local Supabase is not running.\n${result.stderr.toString()}\nRun: bunx supabase start`,
    );
  }
  const values: Record<string, string> = {};
  for (const line of result.stdout.toString().split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3] ?? "";
  }
  const url = values.API_URL ?? values.SUPABASE_URL;
  const anonKey = values.ANON_KEY ?? values.SUPABASE_ANON_KEY;
  const serviceRoleKey = values.SERVICE_ROLE_KEY ?? values.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Could not read local Supabase URL and keys from `supabase status -o env`.");
  }
  return { url, anonKey, serviceRoleKey };
}

async function main() {
  const { url, anonKey, serviceRoleKey } = readLocalSupabaseEnv();
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const email = `context-smoke-${Date.now()}@example.test`;
  const password = "ContextMemoryLocal123!";
  let userId: string | null = null;
  let organizationId: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Context Memory Smoke Test" },
    });
    if (createError || !created.user) throw createError ?? new Error("Could not create test user");
    userId = created.user.id;

    const { data: existingMembership } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    organizationId = existingMembership?.organization_id ?? null;
    if (!organizationId) {
      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .insert({ owner_id: userId, name: "Context Memory Test Company" })
        .select("id")
        .single();
      if (organizationError) throw organizationError;
      organizationId = organization.id;
      const { error: membershipError } = await admin.from("organization_members").insert({
        organization_id: organizationId,
        user_id: userId,
        role: "owner",
      });
      if (membershipError) throw membershipError;
    }

    await admin.from("business_context").upsert(
      {
        organization_id: organizationId,
        identity: {
          name: "Context Memory Test Company",
          industry: "B2B SaaS",
          description: "A local fixture used to verify tenant-scoped context assembly.",
        },
        customer: { target: "Mid-market revenue teams" },
        motion: { channels: ["outbound"], sales_maturity: "repeatable" },
      },
      { onConflict: "organization_id" },
    );
    await admin.from("sales_baselines").insert({
      organization_id: organizationId,
      version: 1,
      status: "active",
      profile: {
        sales_process: "Consultative",
        playbooks: [{ name: "Executive alignment", trigger: "proposal_without_buyer" }],
        rules: [{ name: "Evidence required", value: true }],
      },
      provenance: [{ source_type: "local_fixture", verified: true }],
      created_by: userId,
    });

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        organization_id: organizationId,
        name: "Acme Test",
        domain: "acme.test",
        industry: "Software",
      })
      .select("id")
      .single();
    if (companyError) throw companyError;

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .insert({
        org_id: organizationId,
        user_id: userId,
        first_name: "Jordan",
        last_name: "Buyer",
        email: "jordan@acme.test",
        phone: "+1 (404) 555-0101",
        company: "Acme Test",
        company_id: company.id,
        status: "engaged",
      })
      .select("id")
      .single();
    if (contactError) throw contactError;

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        name: "Acme Expansion",
        company: "Acme Test",
        company_id: company.id,
        contact_id: contact.id,
        stage: "Proposal",
        value: 50000,
      })
      .select("id")
      .single();
    if (leadError) throw leadError;

    const { data: call, error: callError } = await admin
      .from("calls")
      .insert({
        organization_id: organizationId,
        contact_id: contact.id,
        lead_id: lead.id,
        direction: "outbound",
        status: "completed",
        duration: 420,
        provider: "local-fixture",
        provider_call_id: `fixture-${Date.now()}`,
        started_at: new Date().toISOString(),
      })
      .select("id,started_at")
      .single();
    if (callError) throw callError;

    const { data: transcript, error: transcriptError } = await admin
      .from("call_transcripts")
      .insert({
        organization_id: organizationId,
        call_id: call.id,
        transcript_text:
          "Jordan confirmed the budget and requested that the CFO join the security review next Tuesday.",
      })
      .select("id")
      .single();
    if (transcriptError) throw transcriptError;
    await admin.from("context_memory_chunks").insert([
      {
        organization_id: organizationId,
        source_type: "call_transcript",
        source_id: transcript.id,
        transcript_id: transcript.id,
        company_id: company.id,
        contact_id: contact.id,
        lead_id: lead.id,
        call_id: call.id,
        content:
          "Jordan confirmed the budget and requested that the CFO join the security review next Tuesday.",
        chunk_index: 0,
        occurred_at: call.started_at,
        metadata: { fixture: true },
      },
      {
        organization_id: organizationId,
        source_type: "crm_note",
        company_id: company.id,
        contact_id: contact.id,
        lead_id: lead.id,
        content: "The account previously requested executive alignment before the proposal review.",
        chunk_index: 0,
        occurred_at: new Date(Date.now() - 86_400_000).toISOString(),
        metadata: { fixture: true },
      },
    ]);

    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const { data: response, error: invokeError } = await client.functions.invoke(
      "context-package",
      {
        body: {
          organization_id: organizationId,
          task: "local_smoke_test",
          call_id: call.id,
          token_budget: 4000,
        },
      },
    );
    if (invokeError) throw invokeError;
    const context = response?.context;
    if (context?.deal?.id !== lead.id) throw new Error("Context package did not resolve the deal");
    if (context?.contacts?.[0]?.id !== contact.id) {
      throw new Error("Context package did not resolve the contact");
    }
    if (!context?.relevant_history?.length) {
      throw new Error("Context package did not retrieve transcript history");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          package_version: context.package_version,
          context_version: context.receipt.context_version,
          entity: context.entity,
          deal: context.deal.name,
          contact: `${context.contacts[0].first_name} ${context.contacts[0].last_name}`,
          evidence_items: context.relevant_history.length,
          source_references: context.receipt.source_references.length,
          omissions: context.receipt.omissions,
        },
        null,
        2,
      ),
    );
  } finally {
    if (organizationId) await admin.from("organizations").delete().eq("id", organizationId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
