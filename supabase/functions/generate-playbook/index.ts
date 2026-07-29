// generate-playbook — RETIRED (Phase 2 of the progress-spine consolidation).
//
// This function used to turn an accepted Investment Assessment into a
// parallel lesson curriculum (playbooks / playbook_lessons). Lessons were
// merged into the mission spine: teaching copy now lives in
// src/lib/step-execution-guidance.ts keyed by mission_step.tool_key, and
// completion flows through the advance-mission edge function. Minting new
// lessons against the retired vocabulary is intentionally disabled; existing
// playbook_lessons rows are kept as read-only history.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error:
        "The mentor curriculum has been retired — your program now lives on the mission spine.",
      code: "CURRICULUM_RETIRED",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
