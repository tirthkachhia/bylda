// coaching-playbook-guidelines — turns one playbook version into its checklist
// of observable behaviors (the behavior vocabulary later judgments cite by code).
// Authenticates the user (verify_jwt = true); RLS on the version proves access.
// Idempotent: re-running replaces the version's guidelines.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildUsageRows, callPAL } from "../_shared/pal/index.ts";
import {
  GUIDELINES_SYSTEM_PROMPT,
  guidelinesTool,
  normalizeGuidelines,
} from "../_shared/coaching/guidelines.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Guideline extraction is not configured" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to extract guidelines" }, 401);

  const body = (await req.json().catch(() => null)) as { version_id?: unknown } | null;
  const versionId = typeof body?.version_id === "string" ? body.version_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return json({ error: "version_id is required" }, 400);

  // RLS on versions proves membership.
  const { data: version } = await client
    .from("coaching_playbook_versions")
    .select("id, playbook_id, organization_id, version, content")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return json({ error: "Playbook version not found" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const fail = async (message: string, status: number) => {
    await admin
      .from("coaching_playbook_versions")
      .update({ guidelines_error: message })
      .eq("id", version.id);
    return json({ error: message }, status);
  };

  let result;
  try {
    result = await callPAL(
      {
        systemPrompt: GUIDELINES_SYSTEM_PROMPT,
        userPrompt: `Turn this playbook into guidelines.\n\n<playbook version="${version.version}">\n${version.content}\n</playbook>`,
        tool: guidelinesTool,
        maxTokens: 3000,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Guideline extraction failed", 502);
  }

  const guidelines = normalizeGuidelines(result.toolResult);
  if (!guidelines)
    return fail("Could not find enough observable behaviors in this playbook text", 422);

  // Replace, so re-extraction never leaves stale rows behind.
  const { error: deleteError } = await admin
    .from("coaching_playbook_guidelines")
    .delete()
    .eq("version_id", version.id);
  if (deleteError) return fail(deleteError.message, 500);
  const { data: rows, error: insertError } = await admin
    .from("coaching_playbook_guidelines")
    .insert(
      guidelines.map((g) => ({
        organization_id: version.organization_id,
        playbook_id: version.playbook_id,
        version_id: version.id,
        position: g.position,
        code: g.code,
        title: g.title,
        detail: g.detail,
        phase: g.phase,
      })),
    )
    .select("id, version_id, position, code, title, detail, phase");
  if (insertError) return fail(insertError.message, 500);

  await admin
    .from("coaching_playbook_versions")
    .update({ guidelines_extracted_at: new Date().toISOString(), guidelines_error: null })
    .eq("id", version.id);

  const { creditRow, usageRow } = buildUsageRows(result, {
    userId: user.id,
    orgId: version.organization_id,
    workspaceId: null,
    eventType: "coaching_playbook_guidelines",
    resourceKey: "coaching-playbook-guidelines",
  });
  await Promise.all([
    admin.from("credit_ledger").insert(creditRow),
    usageRow ? admin.from("usage_events").insert(usageRow) : Promise.resolve(),
  ]).catch((e) =>
    console.error("[coaching-playbook-guidelines] usage", e instanceof Error ? e.message : e),
  );

  return json({ ok: true, version_id: version.id, guidelines: rows ?? [] });
});
