// compile-workflow — lowers a visual workflow_definitions graph (nodes/edges)
// into the executable automation_workflows shape the workflow-engine runs.
// Validates the graph (one trigger, reachable typed nodes), linearizes it into
// ordered steps (conditions become if_else with nested then/else branches), and
// upserts the compiled workflow, activating it in step with the definition.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

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

type Node = {
  id: string;
  type: string; // trigger | action | condition | delay | end
  data?: Record<string, unknown>;
};
type Edge = { source: string; target: string; branch?: string };
type Graph = { nodes?: Node[]; edges?: Edge[] };
type Step = { type: string; config?: Record<string, unknown>; then?: Step[]; else?: Step[] };

const VALID_TRIGGERS = new Set([
  "contact_created",
  "contact_tagged",
  "lead_stage_changed",
  "form_submitted",
  "appointment_booked",
  "appointment_cancelled",
  "appointment_no_show",
  "message_received",
  "payment_received",
  "manual",
  "schedule",
  "webhook",
]);

class CompileError extends Error {}

function compileGraph(graph: Graph): {
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: Step[];
} {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) {
    throw new CompileError(`Graph must have exactly one trigger node (found ${triggers.length}).`);
  }
  const trigger = triggers[0];
  const triggerType = String(trigger.data?.trigger_type ?? "manual");
  if (!VALID_TRIGGERS.has(triggerType)) {
    throw new CompileError(`Unknown trigger_type: ${triggerType}`);
  }

  const outgoing = (id: string, branch?: string): Edge[] =>
    edges.filter((e) => e.source === id && (branch ? e.branch === branch : true));

  // Depth-guarded traversal from a node id into a linear step chain. Condition
  // nodes fork into then/else; every other node emits one step then follows its
  // single outgoing edge.
  function walk(startId: string | undefined, seen: Set<string>, depth: number): Step[] {
    const steps: Step[] = [];
    let currentId = startId;
    while (currentId) {
      if (depth > 100 || seen.has(currentId)) break; // cycle / runaway guard
      const node = byId.get(currentId);
      if (!node) break;
      seen.add(currentId);

      if (node.type === "end") {
        steps.push({ type: "end" });
        break;
      }
      if (node.type === "trigger") {
        // Skip the trigger itself; continue to what it points at.
        currentId = outgoing(currentId)[0]?.target;
        continue;
      }
      if (node.type === "condition") {
        const thenSteps = walk(
          outgoing(currentId, "then")[0]?.target ?? outgoing(currentId, "true")[0]?.target,
          new Set(seen),
          depth + 1,
        );
        const elseSteps = walk(
          outgoing(currentId, "else")[0]?.target ?? outgoing(currentId, "false")[0]?.target,
          new Set(seen),
          depth + 1,
        );
        steps.push({
          type: "if_else",
          config: { condition: (node.data?.condition ?? {}) as Record<string, unknown> },
          then: thenSteps,
          else: elseSteps,
        });
        break; // both branches are terminal from here
      }

      // action / delay → one step, then follow the single outgoing edge.
      const stepType =
        node.type === "delay"
          ? "wait"
          : String(node.data?.action_type ?? node.data?.type ?? node.type);
      steps.push({ type: stepType, config: (node.data?.config ?? {}) as Record<string, unknown> });
      currentId = outgoing(currentId)[0]?.target;
    }
    return steps;
  }

  const steps = walk(trigger.id, new Set<string>(), 0);
  return {
    trigger_type: triggerType,
    trigger_config: (trigger.data?.config ?? {}) as Record<string, unknown>,
    steps,
  };
}

async function compileDefinition(
  admin: SupabaseClient,
  def: {
    id: string;
    organization_id: string;
    created_by: string | null;
    name: string;
    description: string | null;
    graph: Graph;
    status: string;
    compiled_workflow_id: string | null;
  },
): Promise<{ workflow_id: string; steps: number }> {
  const compiled = compileGraph(def.graph ?? {});
  const isActive = def.status === "active";
  const wfStatus =
    def.status === "archived" ? "archived" : def.status === "active" ? "active" : "paused";

  const payload = {
    organization_id: def.organization_id,
    created_by: def.created_by,
    name: def.name,
    description: def.description,
    trigger_type: compiled.trigger_type,
    trigger_config: compiled.trigger_config,
    steps: compiled.steps,
    is_active: isActive,
    status: wfStatus,
    definition_id: def.id,
  };

  let workflowId = def.compiled_workflow_id;
  if (workflowId) {
    await admin.from("automation_workflows").update(payload).eq("id", workflowId);
  } else {
    const { data, error } = await admin
      .from("automation_workflows")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) throw new CompileError(error?.message ?? "Failed to create workflow");
    workflowId = data.id as string;
  }

  await admin
    .from("workflow_definitions")
    .update({
      compiled_workflow_id: workflowId,
      last_compiled_at: new Date().toISOString(),
      compile_error: null,
    })
    .eq("id", def.id);

  return { workflow_id: workflowId, steps: compiled.steps.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { definition_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const defId = String(body.definition_id ?? "");
  if (!defId) return json({ error: "definition_id is required" }, 400);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const { data: def } = await admin
    .from("workflow_definitions")
    .select(
      "id, organization_id, created_by, name, description, graph, status, compiled_workflow_id",
    )
    .eq("id", defId)
    .maybeSingle();
  if (!def) return json({ error: "Definition not found" }, 404);

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", def.organization_id)
    .maybeSingle();
  if (!member) return json({ error: "Forbidden" }, 403);

  try {
    const result = await compileDefinition(admin, def);
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Compilation failed";
    // Persist the error so the builder can surface it inline.
    await admin.from("workflow_definitions").update({ compile_error: msg }).eq("id", defId);
    return json({ error: msg }, 400);
  }
});
