// run-workflow — executes a Builder block-graph against a contact.
//
// This is the runtime for the visual automation Builder. It walks the workflow
// blocks in order and performs the real side effects for each one:
//   • AI steps  → Claude (Anthropic, optionally via Cloudflare AI Gateway)
//   • Email     → SendGrid           (platform secret or operator BYO key)
//   • SMS       → Twilio             (platform secrets)
//   • Slack     → incoming webhook   (platform secret or operator BYO webhook)
//   • Webhook   → outbound HTTP POST (no credentials needed)
//   • CRM       → tag / status / note / memory writes on the contact
//
// Anything without configured credentials runs in SIMULATION mode and is clearly
// labelled in the run trace, so the engine works the moment it is deployed and
// goes fully live the instant provider secrets are added. In `mode: "test"` all
// external sends and contact mutations are simulated regardless of credentials.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// Mirrors ../_shared/config.ts (inlined to keep this function single-file deployable).
const CLAUDE_MODEL = "claude-sonnet-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ─── Types ─── */
interface Branch {
  id: string;
  label: string;
  blocks: Block[];
}
interface Block {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, string>;
  branches?: Branch[];
}
interface Contact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  lead_score?: number | null;
  status?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}
type StepStatus = "ok" | "simulated" | "skipped" | "error";
interface StepResult {
  block_id: string;
  type: string;
  label: string;
  status: StepStatus;
  detail: string;
  depth: number;
}
interface Creds {
  sendgridKey?: string;
  sendgridFrom: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  slackWebhook?: string;
  anthropicKey?: string;
  aiGatewayUrl?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/* ─── Template interpolation: {{lead.x}}, {{contact.x}}, {{ai.last}} ─── */
function buildVars(contact: Contact | null, ai: Record<string, string>): Record<string, string> {
  const name = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "there"
    : "there";
  return {
    "lead.name": name,
    "contact.name": name,
    "lead.first_name": contact?.first_name ?? "",
    "lead.email": contact?.email ?? "",
    "contact.email": contact?.email ?? "",
    "lead.phone": contact?.phone ?? "",
    "contact.phone": contact?.phone ?? "",
    "lead.company": contact?.company ?? "",
    "contact.company": contact?.company ?? "",
    "ai.last": ai.last ?? "",
    "ai.score": ai.score ?? "",
  };
}
function interpolate(s: string | undefined, vars: Record<string, string>): string {
  if (!s) return "";
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/* ─── Tree helpers ─── */
function countBlocksDeep(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    for (const br of b.branches ?? []) n += countBlocksDeep(br.blocks);
  }
  return n;
}
/** Probability (0–1) of taking Path A from a "70 / 30"-style split config. */
function splitProbabilityA(cfg: string | undefined): number {
  if (!cfg) return 0.5;
  const m = cfg.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return 0.5;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!a && !b) return 0.5;
  return a / (a + b);
}

/* ─── Providers ─── */
async function sendEmail(c: Creds, to: string, subject: string, text: string): Promise<boolean> {
  if (!c.sendgridKey) return false;
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.sendgridKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: c.sendgridFrom, name: "Bylda" },
      subject: subject || "(no subject)",
      content: [{ type: "text/plain", value: text || " " }],
    }),
  });
  return res.ok;
}
async function sendSMS(c: Creds, to: string, body: string): Promise<boolean> {
  if (!c.twilioSid || !c.twilioToken || !c.twilioFrom) return false;
  const form = new URLSearchParams({ To: to, From: c.twilioFrom, Body: body.slice(0, 320) });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${c.twilioSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${c.twilioSid}:${c.twilioToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  return res.ok;
}
async function sendSlack(c: Creds, text: string): Promise<boolean> {
  if (!c.slackWebhook) return false;
  const res = await fetch(c.slackWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}
async function callClaude(
  c: Creds,
  system: string,
  prompt: string,
  maxTokens = 600,
): Promise<string> {
  if (!c.anthropicKey) return "";
  const url = c.aiGatewayUrl
    ? `${c.aiGatewayUrl.replace(/\/$/, "")}/anthropic/v1/messages`
    : "https://api.anthropic.com/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": c.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? "";
}

/* ─── Condition evaluator (best-effort) ─── */
function evalCondition(cond: string, contact: Contact | null, ai: Record<string, string>): boolean {
  if (!cond) return true;
  const c = cond.toLowerCase();
  // numeric score comparisons: "score > 70"
  const m = c.match(/score\s*(>=|<=|>|<|=)\s*(\d+)/);
  if (m) {
    const score = Number(contact?.lead_score ?? ai.score ?? 0);
    const n = Number(m[2]);
    switch (m[1]) {
      case ">":
        return score > n;
      case "<":
        return score < n;
      case ">=":
        return score >= n;
      case "<=":
        return score <= n;
      case "=":
        return score === n;
    }
  }
  // tag check: "tag = vip"
  const t = c.match(/tag\s*=\s*([\w-]+)/);
  if (t && contact?.tags) return contact.tags.map((x) => x.toLowerCase()).includes(t[1]);
  // intent/label check against last AI output: "intent = hot"
  const i = c.match(/=\s*([\w-]+)\s*$/);
  if (i && ai.last) return ai.last.toLowerCase().includes(i[1]);
  return true; // default: continue
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = authHeader.replace("Bearer ", "");

  let body: {
    blocks?: Block[];
    template_id?: string;
    contact_id?: string;
    org_id?: string;
    workflow_name?: string;
    mode?: "test" | "live";
    internal?: boolean;
    user_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Two auth paths:
  //  • internal — the automation-dispatch service (service-role token) running an
  //    active automation on a real event. No user session; ids come from the body.
  //  • user     — a person clicking Run in the Builder (validated JWT).
  let user: { id: string; email: string | null };
  if (body.internal && token === SERVICE_ROLE_KEY && body.user_id) {
    user = { id: body.user_id, email: null };
  } else {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: authedUser },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !authedUser) return json({ error: "Unauthorized" }, 401);
    user = { id: authedUser.id, email: authedUser.email ?? null };
  }

  const mode = body.mode === "live" ? "live" : "test";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve blocks (from request, or load the published template).
  let blocks: Block[] = Array.isArray(body.blocks) ? body.blocks : [];
  let workflowName = body.workflow_name ?? "Workflow";
  const templateId = body.template_id ?? null;
  if (blocks.length === 0 && templateId) {
    const { data: tpl } = await admin
      .from("automation_templates")
      .select("name, blocks")
      .eq("id", templateId)
      .single();
    if (tpl) {
      blocks = (tpl.blocks as Block[]) ?? [];
      workflowName = tpl.name ?? workflowName;
    }
  }
  if (blocks.length === 0) return json({ error: "No workflow steps to run" }, 400);

  // Org scope: provided, else the user's first org.
  let orgId = body.org_id ?? null;
  if (!orgId) {
    const { data: m } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = (m?.organization_id as string) ?? null;
  }
  if (!orgId) return json({ error: "No organization for user" }, 400);

  // Load contact (optional).
  let contact: Contact | null = null;
  if (body.contact_id) {
    const { data } = await admin.from("contacts").select("*").eq("id", body.contact_id).single();
    contact = (data as Contact) ?? null;
  }

  // Resolve credentials: operator BYO (decrypted) overrides platform secrets.
  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  const byo = async (key: string): Promise<string | undefined> => {
    if (!encKey) return undefined;
    const { data } = await admin.rpc("get_user_integration", {
      _user_id: user.id,
      _integration_key: key,
      _encryption_key: encKey,
    });
    return (typeof data === "string" && data) || undefined;
  };
  // Operator BYO credentials (decrypted from the run owner's connected
  // integrations) take priority; platform-wide secrets are the fallback so the
  // engine still works before any operator connects their own provider.
  const creds: Creds = {
    sendgridKey: (await byo("sendgrid")) ?? Deno.env.get("SENDGRID_API_KEY") ?? undefined,
    sendgridFrom:
      (await byo("sendgrid_from")) ??
      Deno.env.get("SENDGRID_FROM_EMAIL") ??
      "bylda@launchpad.usebylda.com",
    twilioSid: (await byo("twilio_sid")) ?? Deno.env.get("TWILIO_ACCOUNT_SID") ?? undefined,
    twilioToken: (await byo("twilio")) ?? Deno.env.get("TWILIO_AUTH_TOKEN") ?? undefined,
    twilioFrom: (await byo("twilio_from")) ?? Deno.env.get("TWILIO_FROM_NUMBER") ?? undefined,
    slackWebhook: (await byo("slack")) ?? Deno.env.get("SLACK_WEBHOOK_URL") ?? undefined,
    anthropicKey: (await byo("anthropic")) ?? Deno.env.get("ANTHROPIC_API_KEY") ?? undefined,
    aiGatewayUrl: Deno.env.get("CLOUDFLARE_AI_GATEWAY_URL") ?? undefined,
  };
  const live = mode === "live";

  const triggerType = blocks.find((b) => b.type.startsWith("trigger_"))?.type ?? null;
  const stepsTotal = countBlocksDeep(blocks);

  // Open a run record.
  const { data: runRow } = await admin
    .from("automation_workflow_runs")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      template_id: templateId,
      workflow_name: workflowName,
      trigger_type: triggerType,
      contact_id: contact?.id ?? null,
      mode,
      status: "running",
      steps_total: stepsTotal,
    })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  const trace: StepResult[] = [];
  const ai: Record<string, string> = {};
  let anySimulated = false;
  let hadError = false;
  const started = Date.now();

  const pushTrace = (b: Block, status: StepStatus, detail: string, depth: number) => {
    if (status === "simulated") anySimulated = true;
    if (status === "error") hadError = true;
    trace.push({ block_id: b.id, type: b.type, label: b.label || b.type, status, detail, depth });
  };

  // Execute an ordered list of blocks. Branching blocks evaluate which lane to
  // take and recurse into only that lane, so the trace reflects the real path.
  const runBlocks = async (list: Block[], depth: number): Promise<void> => {
    // depth-bound trace helper so every step in this lane records its nesting.
    const push = (b: Block, status: StepStatus, detail: string) =>
      pushTrace(b, status, detail, depth);
    for (const b of list) {
      const cfg = b.config ?? {};
      const vars = buildVars(contact, ai);
      try {
        // Triggers — entry points, nothing to execute.
        if (b.type.startsWith("trigger_")) {
          push(
            b,
            "ok",
            `Listening: ${b.label || b.type.replace(/^trigger_/, "").replace(/_/g, " ")}`,
          );
          continue;
        }

        // Branching blocks with real lanes: choose a path and recurse into it.
        if (
          (b.type === "logic_if_branch" || b.type === "logic_split_test") &&
          (b.branches?.length ?? 0) > 0
        ) {
          const branches = b.branches!;
          let chosenIdx: number;
          let detail: string;
          if (b.type === "logic_if_branch") {
            const cond = interpolate(cfg.condition, vars);
            const yes = evalCondition(cond, contact, ai);
            chosenIdx = yes ? 0 : 1;
            detail = `If "${cond || "condition"}" → ${branches[chosenIdx]?.label ?? (yes ? "Yes" : "No")} path`;
          } else {
            const probA = splitProbabilityA(cfg.split);
            chosenIdx = Math.random() < probA ? 0 : 1;
            detail = `A/B split (${cfg.split || "50 / 50"}) → ${branches[chosenIdx]?.label ?? (chosenIdx === 0 ? "A" : "B")} path`;
          }
          push(b, "ok", detail);
          const lane = branches[chosenIdx];
          if (lane && lane.blocks.length > 0) {
            await runBlocks(lane.blocks, depth + 1);
          }
          continue;
        }

        switch (b.type) {
          case "action_send_email": {
            const to = interpolate(cfg.to, vars) || contact?.email || "";
            const subject = interpolate(cfg.subject, vars);
            const text = interpolate(cfg.body, vars);
            if (!to) {
              push(b, "skipped", "No recipient email");
              break;
            }
            if (live && creds.sendgridKey) {
              const ok = await sendEmail(creds, to, subject, text);
              push(
                b,
                ok ? "ok" : "error",
                ok ? `Email sent to ${to}` : `SendGrid send failed for ${to}`,
              );
            } else {
              push(
                b,
                "simulated",
                `Would email ${to}: "${subject || text.slice(0, 40)}"${creds.sendgridKey ? "" : " (no SendGrid key)"}`,
              );
            }
            break;
          }
          case "action_send_sms": {
            const to = interpolate(cfg.to, vars) || contact?.phone || "";
            const msg = interpolate(cfg.message, vars);
            if (!to) {
              push(b, "skipped", "No recipient phone");
              break;
            }
            if (live && creds.twilioSid) {
              const ok = await sendSMS(creds, to, msg);
              push(
                b,
                ok ? "ok" : "error",
                ok ? `SMS sent to ${to}` : `Twilio send failed for ${to}`,
              );
            } else {
              push(
                b,
                "simulated",
                `Would text ${to}: "${msg.slice(0, 48)}"${creds.twilioSid ? "" : " (no Twilio creds)"}`,
              );
            }
            break;
          }
          case "action_notify_team": {
            const msg = interpolate(cfg.message, vars) || `Workflow "${workflowName}" notification`;
            if (live && creds.slackWebhook) {
              const ok = await sendSlack(creds, msg);
              push(b, ok ? "ok" : "error", ok ? "Notified team via Slack" : "Slack notify failed");
            } else if (live && creds.sendgridKey && user.email) {
              const ok = await sendEmail(creds, user.email, "Workflow alert", msg);
              push(b, ok ? "ok" : "error", ok ? `Notified ${user.email}` : "Notify email failed");
            } else {
              push(b, "simulated", `Would notify team: "${msg.slice(0, 48)}"`);
            }
            break;
          }
          case "action_webhook_out": {
            const url = interpolate(cfg.url, vars);
            if (!url || !/^https?:\/\//.test(url)) {
              push(b, "skipped", "No valid webhook URL");
              break;
            }
            if (live) {
              const ok = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflow: workflowName, contact, vars }),
              })
                .then((r) => r.ok)
                .catch(() => false);
              push(b, ok ? "ok" : "error", ok ? `Posted to ${url}` : `Webhook POST failed: ${url}`);
            } else {
              push(b, "simulated", `Would POST to ${url}`);
            }
            break;
          }
          case "action_add_tag":
          case "action_remove_tag": {
            const tag = interpolate(cfg.tag, vars).trim();
            if (!tag || !contact) {
              push(b, "skipped", contact ? "No tag set" : "No contact");
              break;
            }
            if (live) {
              const current = contact.tags ?? [];
              const next =
                b.type === "action_add_tag"
                  ? Array.from(new Set([...current, tag]))
                  : current.filter((x) => x.toLowerCase() !== tag.toLowerCase());
              await admin.from("contacts").update({ tags: next }).eq("id", contact.id);
              contact.tags = next;
              push(b, "ok", `${b.type === "action_add_tag" ? "Added" : "Removed"} tag "${tag}"`);
            } else {
              push(
                b,
                "simulated",
                `Would ${b.type === "action_add_tag" ? "add" : "remove"} tag "${tag}"`,
              );
            }
            break;
          }
          case "action_move_stage":
          case "action_update_crm":
          case "action_set_field": {
            const stage = interpolate(cfg.stage || cfg.value || cfg.field, vars).trim();
            if (!contact) {
              push(b, "skipped", "No contact");
              break;
            }
            if (live && stage) {
              await admin.from("contacts").update({ status: stage }).eq("id", contact.id);
              contact.status = stage;
              push(b, "ok", `Updated contact → "${stage}"`);
            } else {
              push(
                b,
                stage ? "simulated" : "skipped",
                stage ? `Would update contact → "${stage}"` : "Nothing to update",
              );
            }
            break;
          }
          case "action_add_note": {
            const note = interpolate(cfg.note, vars).trim();
            if (!note || !contact) {
              push(b, "skipped", contact ? "No note text" : "No contact");
              break;
            }
            if (live) {
              await admin
                .from("contact_notes")
                .insert({ contact_id: contact.id, user_id: user.id, body: note })
                .then(
                  () => {},
                  () => {},
                );
              push(b, "ok", "Logged note on contact");
            } else {
              push(b, "simulated", `Would log note: "${note.slice(0, 48)}"`);
            }
            break;
          }
          case "memory_write": {
            const what = interpolate(cfg.what_to_save, vars).trim() || "Workflow result";
            if (live) {
              await admin
                .from("operator_memory")
                .insert({
                  user_id: user.id,
                  org_id: orgId,
                  memory_type: "automation_outcome",
                  content: `${workflowName}: ${what}`,
                  tags: ["workflow", "automation_result"],
                  pruned: false,
                })
                .then(
                  () => {},
                  () => {},
                );
              push(b, "ok", `Remembered: "${what.slice(0, 48)}"`);
            } else {
              push(b, "simulated", `Would remember: "${what.slice(0, 48)}"`);
            }
            break;
          }
          case "ai_generate":
          case "ai_classify":
          case "ai_score": {
            if (!creds.anthropicKey) {
              push(b, "simulated", "Would run AI step (no ANTHROPIC_API_KEY)");
              ai.last = "[simulated]";
              break;
            }
            let system = "You are an automation step. Be concise.";
            let prompt = "";
            if (b.type === "ai_generate") {
              system =
                "You write short, personalized outreach. No preamble — output only the message.";
              prompt = `Write a ${cfg.output_type ?? "message"} for ${vars["lead.name"]}${vars["lead.company"] ? ` at ${vars["lead.company"]}` : ""}. ${cfg.context ?? ""}`;
            } else if (b.type === "ai_classify") {
              system = "Classify into exactly one of the labels. Output only the label.";
              prompt = `Classify "${cfg.what_to_classify ?? "the contact"}" into one of: ${cfg.categories ?? "Hot, Warm, Cold"}. Contact: ${vars["lead.name"]} ${vars["lead.company"]}.`;
            } else {
              system = "Score the item. Output only a single integer.";
              prompt = `Score "${cfg.what_to_score ?? "the lead"}" on scale ${cfg.scale ?? "1-100"}. Contact: ${vars["lead.name"]} ${vars["lead.company"]}, current score ${contact?.lead_score ?? "n/a"}.`;
            }
            const out = (await callClaude(creds, system, prompt, 400)).trim();
            ai.last = out;
            if (b.type === "ai_score") {
              const n = out.match(/\d+/);
              if (n) ai.score = n[0];
            }
            push(b, "ok", `AI → ${out.slice(0, 80)}`);
            break;
          }
          case "logic_if_branch": {
            const cond = interpolate(cfg.condition, vars);
            const result = evalCondition(cond, contact, ai);
            push(b, "ok", `If "${cond || "condition"}" → ${result ? "YES path" : "NO path"}`);
            break;
          }
          case "logic_split_test": {
            const yes = Math.random() < 0.5;
            push(b, "ok", `A/B split → path ${yes ? "A" : "B"}`);
            break;
          }
          case "logic_wait":
          case "logic_wait_until": {
            const d = cfg.duration || cfg.until || "a delay";
            push(b, "skipped", `Wait "${d}" — scheduled (delays run via the queue, not inline)`);
            break;
          }
          default:
            // Actions we record but don't yet have a side-effecting integration for.
            push(b, "simulated", `${(b.label || b.type).replace(/_/g, " ")} — recorded`);
        }
      } catch (e) {
        push(b, "error", e instanceof Error ? e.message : String(e));
      }
    }
  };

  await runBlocks(blocks, 0);

  const duration = Date.now() - started;
  const completed = trace.filter((t) => t.status === "ok").length;
  const status = hadError ? "failed" : anySimulated || !live ? "simulated" : "success";

  if (runId) {
    await admin
      .from("automation_workflow_runs")
      .update({ status, steps_completed: completed, trace, duration_ms: duration })
      .eq("id", runId);
  }

  return json({
    run_id: runId,
    status,
    mode,
    simulated: anySimulated || !live,
    steps_total: stepsTotal,
    steps_completed: completed,
    duration_ms: duration,
    trace,
  });
});
