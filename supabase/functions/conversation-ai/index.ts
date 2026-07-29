// conversation-ai — generates a suggested reply for the unified inbox.
// Given a conversation row, it pulls the recent thread for that contact,
// asks Claude for an on-brand reply, saves it to conversations.ai_draft, and
// returns the draft. Non-streaming, self-contained single file.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Msg = { direction: string; channel: string; subject: string | null; body: string };

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

  let body: { conversation_id?: string; instructions?: string; save?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const conversationId = body.conversation_id;
  if (!conversationId) return json({ error: "Missing conversation_id" }, 400);

  // RLS on conversations already scopes this read to the caller's org.
  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("id, organization_id, contact_id, channel, subject, body, direction")
    .eq("id", conversationId)
    .maybeSingle();
  if (convoErr || !convo) return json({ error: "Conversation not found" }, 404);

  // Pull recent thread context: same contact (or same conversation if no contact).
  let thread: Msg[] = [];
  if (convo.contact_id) {
    const { data } = await supabase
      .from("conversations")
      .select("direction, channel, subject, body, created_at")
      .eq("organization_id", convo.organization_id)
      .eq("contact_id", convo.contact_id)
      .order("created_at", { ascending: true })
      .limit(30);
    thread = (data ?? []) as Msg[];
  }
  if (thread.length === 0) {
    thread = [
      {
        direction: convo.direction as string,
        channel: convo.channel as string,
        subject: convo.subject as string | null,
        body: convo.body as string,
      },
    ];
  }

  // Optional contact name for a warmer reply.
  let contactName = "the contact";
  if (convo.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", convo.contact_id)
      .maybeSingle();
    if (c) contactName = [c.first_name, c.last_name].filter(Boolean).join(" ") || contactName;
  }

  const transcript = thread
    .map((m) => {
      const who = m.direction === "inbound" ? contactName : "Us";
      const subj = m.subject ? `[${m.subject}] ` : "";
      return `${who}: ${subj}${m.body}`;
    })
    .join("\n");

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return json({ error: "AI not configured" }, 503);
  const cfGatewayUrl = Deno.env.get("CLOUDFLARE_AI_GATEWAY_URL");
  const endpoint = cfGatewayUrl
    ? `${cfGatewayUrl}/anthropic/v1/messages`
    : "https://api.anthropic.com/v1/messages";

  const channel = convo.channel as string;
  const systemPrompt =
    `You draft replies for a business inbox. Write a single ${channel} reply to ${contactName} that moves the conversation forward and sounds like a helpful, professional human on the team. ` +
    (channel === "sms"
      ? "Keep it under 320 characters, friendly and concise. No subject line."
      : "Keep it concise and well-structured. Do not invent a subject line or signature.") +
    " Respond with only the reply text — no preamble, no quotes, no labels." +
    (body.instructions ? `\n\nExtra guidance from the user: ${body.instructions}` : "");

  const aiRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the conversation so far:\n\n${transcript}\n\nDraft the next reply from us.`,
        },
      ],
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    return json({ error: "AI error", detail }, 502);
  }

  const data = await aiRes.json();
  const draft: string =
    Array.isArray(data.content) && data.content[0]?.type === "text"
      ? data.content[0].text.trim()
      : "";
  if (!draft) return json({ error: "Empty draft" }, 502);

  // Persist the draft (service role) so it survives even if RLS update is strict.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && body.save !== false) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    await admin
      .from("conversations")
      .update({ ai_draft: draft })
      .eq("id", conversationId)
      .then(
        () => {},
        () => {},
      );
  }

  return json({ draft });
});
