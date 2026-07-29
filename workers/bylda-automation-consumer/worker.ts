// bylda-automation-consumer — Cloudflare Queue consumer
// Processes automation jobs from nova-automation-queue.
// Routes by automation_slug to one of 6 handlers.

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_AI_GATEWAY_ID: string;
  SENDGRID_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
}

interface AutomationJob {
  automation_slug: string;
  payload: Record<string, unknown>;
  user_id: string;
  triggered_at: string;
  log_id?: string;
}

const CLAUDE_MODEL = "claude-sonnet-4-5";

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
function sbHeaders(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function fetchFromSupabase<T>(path: string, env: Env): Promise<T[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(env),
  });
  if (!res.ok) return [];
  return res.json() as Promise<T[]>;
}

async function postToSupabase(
  path: string,
  body: Record<string, unknown>,
  env: Env,
  method: "POST" | "PATCH" = "POST",
  extraHeaders: Record<string, string> = {},
): Promise<boolean> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...sbHeaders(env), ...extraHeaders },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// AI helper — call Claude via Cloudflare AI Gateway
// ---------------------------------------------------------------------------
async function callClaude(
  userPrompt: string,
  systemPrompt: string,
  env: Env,
  maxTokens = 1024,
): Promise<string> {
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_AI_GATEWAY_ID}/anthropic/v1/messages`;

  const res = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Email helper — SendGrid
// ---------------------------------------------------------------------------
async function sendEmail(
  to: string,
  subject: string,
  text: string,
  env: Env,
  html?: string,
): Promise<boolean> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "bylda@launchpad.usebylda.com", name: "Bylda" },
      subject,
      content: [
        { type: "text/plain", value: text },
        ...(html ? [{ type: "text/html", value: html }] : []),
      ],
    }),
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// SMS helper — Twilio
// ---------------------------------------------------------------------------
async function sendSMS(to: string, body: string, env: Env): Promise<boolean> {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const twilioNumber = "+18334509482"; // Should be env var in production

  const formBody = new URLSearchParams({
    To: to,
    From: twilioNumber,
    Body: body.slice(0, 160), // TCPA / SMS limit
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    },
  );
  return res.ok;
}

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------
async function updateLog(
  logId: string | undefined,
  status: "success" | "failed",
  durationMs: number,
  error: string | null,
  env: Env,
): Promise<void> {
  if (!logId) return;
  await postToSupabase(
    `automation_logs?id=eq.${logId}`,
    {
      status,
      duration_ms: durationMs,
      error_message: error,
      completed_at: new Date().toISOString(),
    },
    env,
    "PATCH",
  );
}

// ---------------------------------------------------------------------------
// Automation handlers
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  status?: string;
  lead_score?: number;
  tags?: string[];
}

interface UserContext {
  business_name?: string;
  product_description?: string;
  target_customer?: string;
  founder_name?: string;
  [key: string]: string | undefined;
}

// 1. ai-appointment-setting
async function handleAiAppointmentSetting(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;
  const contactId = payload.contact_id as string;

  // Fetch contact
  const contacts = await fetchFromSupabase<Contact>(
    `contacts?id=eq.${contactId}&user_id=eq.${user_id}`,
    env,
  );
  const contact = contacts[0];
  if (!contact) throw new Error(`Contact ${contactId} not found`);

  // Fetch user context
  const ctxRows = await fetchFromSupabase<UserContext>(
    `user_contexts?user_id=eq.${user_id}&limit=1`,
    env,
  );
  const userContext = ctxRows[0] ?? {};

  const systemPrompt = `You are Bylda — an AI appointment-setting assistant for ${userContext.business_name ?? "this business"}.

Your role: write a highly personalized, Hormozi-style outreach message that gets a reply. Use the Value Equation: Dream Outcome × Perceived Likelihood of Achievement / Time Delay × Effort and Sacrifice.

Business: ${userContext.business_name ?? "Unknown"}
Product: ${userContext.product_description ?? "Unknown"}
Target customer: ${userContext.target_customer ?? "Unknown"}

Rules:
- Under 150 words
- Open with a specific observation or insight about their situation
- Lead with value, not a pitch
- End with a single, low-friction ask (15-min call)
- No corporate language, no "I hope this finds you well"
- TCPA compliant if SMS`;

  const prompt = `Write a personalized outreach message to:
Name: ${contact.first_name ?? ""} ${contact.last_name ?? ""}
Company: ${contact.company ?? ""}
Channel: ${(payload.channel as string) ?? "email"}

Goal: Book an appointment / discovery call.`;

  const message = await callClaude(prompt, systemPrompt, env);

  // Send via preferred channel
  const channel = (payload.channel as string) ?? "email";
  let sent = false;

  if (channel === "sms" && contact.phone) {
    sent = await sendSMS(contact.phone, message, env);
  } else if (contact.email) {
    const subject = `Quick question about ${contact.company ?? "your business"}`;
    sent = await sendEmail(contact.email, subject, message, env);
  }

  // Update contact status
  if (sent) {
    await postToSupabase(
      `contacts?id=eq.${contactId}`,
      {
        status: "contacted",
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      env,
      "PATCH",
    );
  }

  // Log result
  await postToSupabase(
    "automation_results",
    {
      user_id,
      automation_slug: job.automation_slug,
      contact_id: contactId,
      channel,
      message_sent: message,
      sent,
      created_at: new Date().toISOString(),
    },
    env,
  );
}

// 2. ai-followup-sequences
async function handleAiFollowupSequences(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;
  const contactId = payload.contact_id as string;

  const contacts = await fetchFromSupabase<Contact>(
    `contacts?id=eq.${contactId}&user_id=eq.${user_id}`,
    env,
  );
  const contact = contacts[0];
  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const ctxRows = await fetchFromSupabase<UserContext>(
    `user_contexts?user_id=eq.${user_id}&limit=1`,
    env,
  );
  const userContext = ctxRows[0] ?? {};

  const systemPrompt = `You are Bylda — designing a 5-touch follow-up sequence using NEPQ (Neuro-Emotional Persuasion Questioning) principles.

Business: ${userContext.business_name ?? "Unknown"}
Product: ${userContext.product_description ?? "Unknown"}

Design a 5-touch sequence (mix of email and SMS) that:
1. Connects emotionally with the prospect's situation
2. Uses NEPQ problem-awareness questions to surface pain
3. Builds logical and emotional reasons to take action
4. Progressively increases urgency
5. Ends with a clear close or disqualification

Output: JSON array of 5 objects with: { touch: number, channel: "email"|"sms", delay_hours: number, subject: string, body: string }`;

  const prompt = `Create a 5-touch follow-up sequence for:
Name: ${contact.first_name ?? ""} ${contact.last_name ?? ""}
Company: ${contact.company ?? ""}
Previous interaction: ${(payload.previous_interaction as string) ?? "Initial outreach sent"}`;

  const sequenceText = await callClaude(prompt, systemPrompt, env, 2048);

  // Parse sequence
  let sequence: Array<{
    touch: number;
    channel: string;
    delay_hours: number;
    subject: string;
    body: string;
  }> = [];
  try {
    const jsonMatch = sequenceText.match(/\[[\s\S]*\]/);
    if (jsonMatch) sequence = JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: create a simple sequence
    sequence = [
      {
        touch: 1,
        channel: "email",
        delay_hours: 0,
        subject: "Following up",
        body: sequenceText.slice(0, 500),
      },
    ];
  }

  // Execute touch 1 immediately
  const touch1 = sequence[0];
  if (touch1) {
    if (touch1.channel === "sms" && contact.phone) {
      await sendSMS(contact.phone, touch1.body, env);
    } else if (contact.email) {
      await sendEmail(contact.email, touch1.subject, touch1.body, env);
    }
  }

  // Store sequence in automation_configs for future touches
  await postToSupabase(
    "automation_configs",
    {
      user_id,
      automation_slug: "ai-followup-sequences",
      contact_id: contactId,
      config: { sequence, current_touch: 1, completed: false },
      next_run_at: touch1
        ? new Date(Date.now() + (sequence[1]?.delay_hours ?? 24) * 3600 * 1000).toISOString()
        : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    env,
    "POST",
    { Prefer: "resolution=merge-duplicates" },
  );

  // Update contact status if all touches done with no reply → cold
  if (contact.status === "no_reply") {
    await postToSupabase(
      `contacts?id=eq.${contactId}`,
      { status: "cold", updated_at: new Date().toISOString() },
      env,
      "PATCH",
    );
  }
}

// 3. crm-automation
async function handleCrmAutomation(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;
  const contactData = payload.contact as Record<string, string>;

  const ctxRows = await fetchFromSupabase<UserContext>(
    `user_contexts?user_id=eq.${user_id}&limit=1`,
    env,
  );
  const userContext = ctxRows[0] ?? {};

  // Normalize and create/update contact
  const normalizedContact = {
    user_id,
    first_name: contactData.first_name ?? "",
    last_name: contactData.last_name ?? "",
    email: contactData.email ?? "",
    phone: contactData.phone ?? "",
    company: contactData.company ?? "",
    source: contactData.source ?? "crm-automation",
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts`, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(normalizedContact),
  });
  const inserted = (await insertRes.json()) as Contact[];
  const contact = inserted[0];
  if (!contact) throw new Error("Failed to create contact");

  // Score lead with Claude
  const systemPrompt = `You are Bylda — a lead scoring AI. Score this lead 1-100 based on ICP match.

ICP: ${userContext.target_customer ?? "Unknown"}
Product: ${userContext.product_description ?? "Unknown"}

Scoring criteria:
- Company size fit (20pts)
- Industry relevance (20pts)
- Title/role fit (20pts)
- Intent signals (20pts)
- Contact data completeness (20pts)

Output ONLY a JSON object: { "score": number, "reasoning": string, "tags": string[] }`;

  const prompt = `Score this lead:
Name: ${contact.first_name} ${contact.last_name}
Company: ${contact.company}
Email: ${contact.email}
Source: ${contactData.source ?? "unknown"}
Notes: ${contactData.notes ?? ""}`;

  const scoreText = await callClaude(prompt, systemPrompt, env);
  let scoreData: { score: number; reasoning: string; tags: string[] } = {
    score: 50,
    reasoning: "",
    tags: [],
  };
  try {
    const jsonMatch = scoreText.match(/\{[\s\S]*\}/);
    if (jsonMatch) scoreData = JSON.parse(jsonMatch[0]);
  } catch {
    /* use defaults */
  }

  // Update contact with score and tags
  await postToSupabase(
    `contacts?id=eq.${contact.id}`,
    {
      lead_score: scoreData.score,
      tags: scoreData.tags,
      score_reasoning: scoreData.reasoning,
      updated_at: new Date().toISOString(),
    },
    env,
    "PATCH",
  );

  // Route based on score
  if (scoreData.score >= 70) {
    // High quality lead → appointment setting
    await job_enqueue_placeholder(
      "ai-appointment-setting",
      { contact_id: contact.id, channel: "email" },
      user_id,
    );
  } else if (scoreData.score >= 40) {
    // Nurture lead
    await postToSupabase(
      `contacts?id=eq.${contact.id}`,
      { tags: [...(scoreData.tags ?? []), "nurture"], updated_at: new Date().toISOString() },
      env,
      "PATCH",
    );
    await job_enqueue_placeholder("ai-followup-sequences", { contact_id: contact.id }, user_id);
  } else {
    // Low priority
    await postToSupabase(
      `contacts?id=eq.${contact.id}`,
      { tags: [...(scoreData.tags ?? []), "low-priority"], updated_at: new Date().toISOString() },
      env,
      "PATCH",
    );
  }

  // Notify founder
  const founderRows = await fetchFromSupabase<{ email: string }>(
    `users?id=eq.${user_id}&select=email`,
    env,
  );
  const founderEmail = founderRows[0]?.email;
  if (founderEmail) {
    await sendEmail(
      founderEmail,
      `New lead scored: ${contact.first_name} ${contact.last_name} — ${scoreData.score}/100`,
      `A new lead has been processed by Bylda CRM Automation.\n\nContact: ${contact.first_name} ${contact.last_name}\nCompany: ${contact.company}\nScore: ${scoreData.score}/100\nAction: ${scoreData.score >= 70 ? "Appointment setting initiated" : scoreData.score >= 40 ? "Nurture sequence started" : "Tagged as low priority"}\n\nReasoning: ${scoreData.reasoning}`,
      env,
    );
  }
}

// 4. lead-qualification
async function handleLeadQualification(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;
  const contactId = payload.contact_id as string;

  const contacts = await fetchFromSupabase<Contact>(
    `contacts?id=eq.${contactId}&user_id=eq.${user_id}`,
    env,
  );
  const contact = contacts[0];
  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const ctxRows = await fetchFromSupabase<UserContext>(
    `user_contexts?user_id=eq.${user_id}&limit=1`,
    env,
  );
  const userContext = ctxRows[0] ?? {};

  const systemPrompt = `You are Bylda — generating BANT qualification questions tailored to a specific business.

Business: ${userContext.business_name ?? "Unknown"}
Product: ${userContext.product_description ?? "Unknown"}

BANT Framework:
- Budget: Do they have the financial capacity?
- Authority: Are they the decision maker?
- Need: Do they have the problem we solve?
- Timeline: Are they looking to act soon?

Create 4 BANT questions (one per dimension) that feel natural and conversational — not interrogative.
Output as a numbered list.`;

  const prompt = `Generate qualification questions for:
Name: ${contact.first_name ?? ""} ${contact.last_name ?? ""}
Company: ${contact.company ?? ""}`;

  const questions = await callClaude(prompt, systemPrompt, env);

  // Send qualifying questions via email or SMS
  const channel = (payload.channel as string) ?? "email";
  if (channel === "sms" && contact.phone) {
    await sendSMS(
      contact.phone,
      `Hi ${contact.first_name ?? "there"}, I'd love to learn more about your situation. Could you answer a quick question? ${questions.split("\n")[0] ?? ""}`,
      env,
    );
  } else if (contact.email) {
    await sendEmail(
      contact.email,
      `Quick question — ${contact.first_name ?? "there"}`,
      `Hi ${contact.first_name ?? "there"},\n\nBefore we connect, I wanted to ask a few quick questions to make sure we're a good fit:\n\n${questions}\n\nFeel free to reply directly to this email.\n\nBylda`,
      env,
    );
  }

  // Store qualification state
  await postToSupabase(
    "automation_configs",
    {
      user_id,
      automation_slug: "lead-qualification",
      contact_id: contactId,
      config: { questions, status: "awaiting_response", channel },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    env,
    "POST",
    { Prefer: "resolution=merge-duplicates" },
  );

  // Update contact status
  await postToSupabase(
    `contacts?id=eq.${contactId}`,
    { status: "qualifying", updated_at: new Date().toISOString() },
    env,
    "PATCH",
  );
}

// 5. sms-automation
async function handleSmsAutomation(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;
  const contactId = payload.contact_id as string;

  const contacts = await fetchFromSupabase<Contact>(
    `contacts?id=eq.${contactId}&user_id=eq.${user_id}`,
    env,
  );
  const contact = contacts[0];
  if (!contact?.phone) throw new Error(`Contact ${contactId} not found or has no phone`);

  const ctxRows = await fetchFromSupabase<UserContext>(
    `user_contexts?user_id=eq.${user_id}&limit=1`,
    env,
  );
  const userContext = ctxRows[0] ?? {};

  const systemPrompt = `You are Bylda — writing a TCPA-compliant SMS message (max 160 characters).

Business: ${userContext.business_name ?? "Unknown"}
Purpose: ${(payload.purpose as string) ?? "Follow-up"}

TCPA rules:
- Include opt-out: "Reply STOP to unsubscribe"
- No deceptive content
- Identify the sender
- Max 160 chars total including opt-out

Write ONLY the SMS text. Count characters carefully.`;

  const prompt = `Write an SMS to:
Name: ${contact.first_name ?? ""}
Company: ${contact.company ?? ""}
Message goal: ${(payload.goal as string) ?? "Re-engage and book a call"}`;

  const smsText = await callClaude(prompt, systemPrompt, env);
  const finalSms = smsText.slice(0, 160);

  const sent = await sendSMS(contact.phone, finalSms, env);

  // Log result
  await postToSupabase(
    "automation_results",
    {
      user_id,
      automation_slug: job.automation_slug,
      contact_id: contactId,
      channel: "sms",
      message_sent: finalSms,
      sent,
      created_at: new Date().toISOString(),
    },
    env,
  );

  if (sent) {
    await postToSupabase(
      `contacts?id=eq.${contactId}`,
      { last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      env,
      "PATCH",
    );
  }
}

// 6. voice-ai
async function handleVoiceAi(job: AutomationJob, env: Env): Promise<void> {
  const { payload, user_id } = job;

  // Fetch voice config
  const configs = await fetchFromSupabase<{
    id: string;
    config: {
      greeting?: string;
      book_url?: string;
      business_name?: string;
      faq?: Record<string, string>;
    };
  }>(`automation_configs?user_id=eq.${user_id}&automation_slug=eq.voice-ai&limit=1`, env);
  const voiceConfig = configs[0]?.config ?? {};

  const callerIntent = (payload.intent as string) ?? "info";
  const callSid = payload.call_sid as string;
  const callerNumber = payload.from as string;

  let twiml = "";

  switch (callerIntent) {
    case "book":
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Great, I'll help you book an appointment. I'm sending a booking link to your phone now. You can also visit ${voiceConfig.book_url ?? "our website"} to schedule directly.</Say>
  <Sms to="${callerNumber}" from="${payload.to_number ?? ""}">${voiceConfig.book_url ?? "Book here"}</Sms>
  <Say voice="Polly.Joanna">Is there anything else I can help you with today?</Say>
  <Gather numDigits="1" action="/api/automations/trigger" method="POST">
    <Say voice="Polly.Joanna">Press 1 for more information, or press 2 to speak with a team member.</Say>
  </Gather>
</Response>`;
      break;

    case "human":
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you with a team member now. Please hold for just a moment.</Say>
  <Dial timeout="30">
    <Number>${(voiceConfig as Record<string, string>).forward_number ?? ""}</Number>
  </Dial>
  <Say voice="Polly.Joanna">Sorry, no one is available right now. Leave a message after the tone and we'll call you back within one business day.</Say>
  <Record maxLength="60" />
</Response>`;
      break;

    case "faq": {
      const question = (payload.question as string) ?? "";
      const answer =
        voiceConfig.faq?.[question] ??
        "I don't have that information available right now, but our team will be happy to help.";
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${answer}</Say>
  <Gather numDigits="1" action="/api/automations/trigger" method="POST">
    <Say voice="Polly.Joanna">Press 1 to book an appointment, press 2 to speak with a team member, or press 9 to end the call.</Say>
  </Gather>
</Response>`;
      break;
    }

    default: // info
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling ${voiceConfig.business_name ?? "us"}. I'm Bylda, an AI assistant. I can help you book an appointment, answer questions, or connect you with our team.</Say>
  <Gather numDigits="1" action="/api/automations/trigger" method="POST">
    <Say voice="Polly.Joanna">Press 1 to book an appointment. Press 2 for information about our services. Press 3 to speak with a team member.</Say>
  </Gather>
</Response>`;
  }

  // Log call
  await postToSupabase(
    "automation_results",
    {
      user_id,
      automation_slug: "voice-ai",
      channel: "voice",
      call_sid: callSid,
      caller_number: callerNumber,
      intent: callerIntent,
      twiml_response: twiml,
      created_at: new Date().toISOString(),
    },
    env,
  );
}

// ---------------------------------------------------------------------------
// Placeholder for queue re-enqueue (in production, use env.AUTOMATION_QUEUE.send())
// This function exists so handlers can trigger sub-jobs.
// In a real deployment, the consumer would need access to the queue binding.
// ---------------------------------------------------------------------------
async function job_enqueue_placeholder(
  automation_slug: string,
  payload: Record<string, unknown>,
  user_id: string,
): Promise<void> {
  // In production: await env.AUTOMATION_QUEUE.send({ automation_slug, payload, user_id, triggered_at: new Date().toISOString() });
  console.log(`[Bylda] Would enqueue: ${automation_slug} for user ${user_id}`, payload);
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------
async function routeAutomation(job: AutomationJob, env: Env): Promise<void> {
  switch (job.automation_slug) {
    case "ai-appointment-setting":
      return handleAiAppointmentSetting(job, env);
    case "ai-followup-sequences":
      return handleAiFollowupSequences(job, env);
    case "crm-automation":
      return handleCrmAutomation(job, env);
    case "lead-qualification":
      return handleLeadQualification(job, env);
    case "sms-automation":
      return handleSmsAutomation(job, env);
    case "voice-ai":
      return handleVoiceAi(job, env);
    default:
      throw new Error(`Unknown automation_slug: ${job.automation_slug}`);
  }
}

// ---------------------------------------------------------------------------
// Queue consumer export
// ---------------------------------------------------------------------------
export default {
  async queue(batch: MessageBatch<AutomationJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const job = msg.body;
      const start = Date.now();
      try {
        await routeAutomation(job, env);
        await updateLog(job.log_id, "success", Date.now() - start, null, env);
        msg.ack();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Bylda] Automation failed [${job.automation_slug}]:`, errorMsg);
        await updateLog(job.log_id, "failed", Date.now() - start, errorMsg, env);
        msg.retry();
      }
    }
  },
};
