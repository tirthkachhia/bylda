// Edge function: feedback-loop
// Scheduled every 30 minutes. Detects cases where the same org ran the same
// tool with the same input more than once within 15 minutes (a signal that the
// output was unsatisfactory), then asks Claude to suggest a prompt improvement
// and saves it to prompt_feedback.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/helpers.ts";
import { CLAUDE_MODEL } from "../_shared/config.ts";

const WINDOW_MINUTES = 15;

type EventRow = {
  org_id: string;
  tool_name: string;
  input_hash: string;
  input_summary: string | null;
};

type GroupEntry = EventRow & { count: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Use service role to bypass RLS for read/write across all orgs
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // Fetch all tool events from within the window
  const { data: events, error: eventsErr } = await supabase
    .from("tool_events")
    .select("org_id, tool_name, input_hash, input_summary")
    .gte("ran_at", windowStart);

  if (eventsErr) {
    console.error("[feedback-loop] fetch error:", eventsErr);
    return jsonResponse({ error: "Failed to read tool_events" }, 500);
  }

  // Group by (org_id, tool_name, input_hash) and keep groups with count > 1
  const groups = new Map<string, GroupEntry>();
  for (const row of (events ?? []) as EventRow[]) {
    const key = `${row.org_id}::${row.tool_name}::${row.input_hash}`;
    const entry = groups.get(key);
    if (!entry) {
      groups.set(key, { ...row, count: 1 });
    } else {
      entry.count++;
    }
  }

  const repeated = Array.from(groups.values()).filter((g) => g.count > 1);

  if (repeated.length === 0) {
    return jsonResponse({ processed: 0, message: "No repeated runs detected" });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let processed = 0;

  for (const group of repeated) {
    // Skip if we already created feedback for this hash in this window
    const { data: existing } = await supabase
      .from("prompt_feedback")
      .select("id")
      .eq("org_id", group.org_id)
      .eq("tool_name", group.tool_name)
      .eq("input_hash", group.input_hash)
      .gte("created_at", windowStart)
      .maybeSingle();

    if (existing) continue;

    // Ask Claude for a specific improvement suggestion
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        system: `You are a prompt engineer. A founder re-ran the same AI tool ${group.count} times with identical input within 15 minutes — a strong signal the output was unsatisfactory. Analyse the tool name and input, then suggest ONE specific, actionable improvement: what additional context should be provided, or how the input should be reframed to yield a much better output. Be direct and concrete. 2-3 sentences maximum.`,
        messages: [
          {
            role: "user",
            content: `Tool: ${group.tool_name}\nInput: ${group.input_summary ?? "(not available)"}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      console.warn("[feedback-loop] Claude request failed:", resp.status);
      continue;
    }

    const data = await resp.json();
    const suggestion = data.content?.[0]?.type === "text" ? (data.content[0].text as string) : null;

    if (!suggestion) continue;

    const { error: insertErr } = await supabase.from("prompt_feedback").insert({
      org_id: group.org_id,
      tool_name: group.tool_name,
      input_hash: group.input_hash,
      repeat_count: group.count,
      suggestion,
    });

    if (insertErr) {
      console.error("[feedback-loop] insert error:", insertErr);
    } else {
      processed++;
    }
  }

  return jsonResponse({ processed, repeated_groups: repeated.length });
});
