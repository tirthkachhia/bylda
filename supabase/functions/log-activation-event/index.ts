// TASK-047 · Activation Event Logging
//
// Lightweight endpoint to log any activation event from the client.
// agent_runs and activation_events use service-role for writes,
// so this function bridges client auth → service-role insert.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

const ALLOWED_EVENTS = new Set([
  "workspace_created",
  "onboarding_complete",
  "first_mission_assigned",
  "first_tool_run",
  "first_mission_completed",
  "plan_upgraded",
  "weekly_return",
  "tool_run_succeeded",
  "mission_step_completed",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Verify JWT
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  let body: { event_name: string; workspace_id?: string; properties?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { event_name, workspace_id, properties = {} } = body;
  if (!event_name) return json({ error: "event_name is required" }, 400);
  if (!ALLOWED_EVENTS.has(event_name)) {
    return json({ error: `Unknown event: ${event_name}` }, 400);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { error } = await adminClient.from("activation_events").insert({
    user_id: userId,
    workspace_id: workspace_id ?? null,
    event_name,
    properties,
  });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
