import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildContextPackage } from "../_shared/context-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  organization_id?: string;
  task?: string;
  call_id?: string;
  lead_id?: string;
  contact_id?: string;
  company_id?: string;
  token_budget?: number;
  query_embedding?: number[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.organization_id) return json({ error: "organization_id is required" }, 400);
  if (!body.task?.trim()) return json({ error: "task is required" }, 400);
  if (body.query_embedding && body.query_embedding.length !== 1536) {
    return json({ error: "query_embedding must contain 1536 numbers" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const context = await buildContextPackage(admin, {
      organizationId: body.organization_id,
      userId: userData.user.id,
      task: body.task.trim(),
      callId: body.call_id,
      leadId: body.lead_id,
      contactId: body.contact_id,
      companyId: body.company_id,
      tokenBudget: body.token_budget,
      queryEmbedding: body.query_embedding,
    });
    return json({ context });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Context assembly failed";
    const status = message.includes("not a member")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    console.error("[context-package]", message);
    return json({ error: message }, status);
  }
});
