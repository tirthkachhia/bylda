// Edge function: memory-query
// Fetches the org's indexed memory artifacts, builds context, and answers
// the user's question using Claude claude-sonnet-4-5.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/helpers.ts";

const MEMORY_QUERY_MODEL = "claude-sonnet-4-5";

type ArtifactRow = {
  title: string;
  content_preview: string | null;
  source_type: string;
  source_label: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth) return jsonResponse({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Invalid token" }, 401);

  let body: { query: string; orgId: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { query, orgId } = body;
  if (!query?.trim()) return jsonResponse({ error: "query is required" }, 400);
  if (!orgId) return jsonResponse({ error: "orgId is required" }, 400);

  // Fetch indexed memory artifacts for this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: artifacts, error: artifactsErr } = await db
    .from("memory_artifacts")
    .select("title, content_preview, source_type, source_label")
    .eq("org_id", orgId)
    .eq("status", "indexed")
    .order("updated_at", { ascending: false })
    .limit(60);

  if (artifactsErr) {
    console.error("[memory-query] artifact fetch error:", artifactsErr);
    return jsonResponse({ error: "Failed to fetch memory artifacts" }, 500);
  }

  const docs = (artifacts ?? []) as ArtifactRow[];

  if (docs.length === 0) {
    return jsonResponse({
      answer: "No indexed content found. Add and index sources on the Sources tab before querying.",
      sources_searched: 0,
    });
  }

  // Build context from artifacts
  const context = docs
    .map((a) => {
      const source = a.source_label ?? a.source_type;
      const preview = a.content_preview ?? "(no preview)";
      return `### [${source}] ${a.title}\n${preview}`;
    })
    .join("\n\n");

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "AI not configured" }, 500);

  const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MEMORY_QUERY_MODEL,
      max_tokens: 1024,
      system: `You are a company knowledge assistant. Answer the user's question using only the indexed content below. Be specific and cite which source you're drawing from (e.g. "[Tool: idea-validator]" or "[notion] Doc title"). If the answer is not in the context, say so clearly and briefly.\n\n--- COMPANY KNOWLEDGE BASE ---\n\n${context}\n\n---`,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!claudeResp.ok) {
    const errText = await claudeResp.text();
    console.error("[memory-query] Claude error:", claudeResp.status, errText);
    return jsonResponse({ error: "AI service error" }, 500);
  }

  const claudeData = await claudeResp.json();
  const answer =
    claudeData.content?.[0]?.type === "text"
      ? (claudeData.content[0].text as string)
      : "No response generated.";

  return jsonResponse({ answer, sources_searched: docs.length });
});
