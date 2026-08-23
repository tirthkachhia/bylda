import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callPAL } from "../_shared/pal/index.ts";
import {
  SALES_VERTICAL_PROFILES,
  resolveSalesVertical,
  type FieldSensitivity,
  type SalesVerticalKey,
  type VerticalFieldSpec,
} from "../_shared/sales-verticals.ts";

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

type Answers = {
  business_description?: string;
  buyer_and_motion?: string;
  call_goal?: string;
  must_capture?: string[];
  custom_capture?: string;
  review_mode?: "conservative" | "balanced" | "fast";
};

type GeneratedField = {
  key?: unknown;
  label?: unknown;
  description?: unknown;
  entity?: unknown;
  required?: unknown;
  sensitivity?: unknown;
};

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const textList = (value: unknown, maxItems = 12, maxLength = 160) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const slug = (value: unknown) =>
  text(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

const sensitivityRank: Record<FieldSensitivity, number> = {
  standard: 0,
  review: 1,
  restricted: 2,
};

const HIGH_RISK_FIELD =
  /(^|_)(ssn|social_security|dob|date_of_birth|medical|diagnosis|medication|bank|routing|card|payment|credit_score|government_id)(_|$)/i;

function strongerSensitivity(left: FieldSensitivity, right: FieldSensitivity): FieldSensitivity {
  return sensitivityRank[left] >= sensitivityRank[right] ? left : right;
}

function normalizeFields(baseKey: SalesVerticalKey, rawFields: unknown): VerticalFieldSpec[] {
  const base = SALES_VERTICAL_PROFILES[baseKey];
  const baseByKey = new Map(base.fields.map((field) => [field.key, field]));
  const proposed = Array.isArray(rawFields) ? (rawFields as GeneratedField[]) : [];
  const fields = new Map<string, VerticalFieldSpec>();

  // These three make the post-call loop useful for every sales motion.
  for (const key of ["call_outcome", "deal_stage", "next_step"]) {
    const spec = baseByKey.get(key);
    if (spec) fields.set(key, spec);
  }

  for (const raw of proposed.slice(0, 16)) {
    const key = slug(raw.key || raw.label);
    const label = text(raw.label, 80);
    const description = text(raw.description, 240);
    if (!key || !label || !description || fields.has(key)) continue;

    const baseSpec = baseByKey.get(key);
    const suppliedSensitivity: FieldSensitivity =
      raw.sensitivity === "restricted" || raw.sensitivity === "review"
        ? raw.sensitivity
        : "standard";
    const sensitivity = HIGH_RISK_FIELD.test(key)
      ? "restricted"
      : strongerSensitivity(baseSpec?.sensitivity ?? "standard", suppliedSensitivity);
    const entity = raw.entity === "contact" ? "contact" : "lead";
    const crmTarget =
      sensitivity === "restricted"
        ? `blocked.${key}`
        : (baseSpec?.crmTarget ?? `${entity}.custom_fields.bylda_${key}`);

    fields.set(key, {
      key,
      label,
      description,
      crmTarget,
      required: Boolean(raw.required),
      sensitivity,
    });
  }

  // A model cannot remove built-in restricted-data guards for the selected industry.
  for (const spec of base.fields.filter((field) => field.sensitivity === "restricted")) {
    fields.set(spec.key, spec);
  }

  // A sparse model response still receives the proven industry template.
  if (fields.size < 6) {
    for (const spec of base.fields) {
      if (!fields.has(spec.key)) fields.set(spec.key, spec);
      if (fields.size >= 10) break;
    }
  }

  return [...fields.values()].slice(0, 18);
}

function confidenceFor(mode: Answers["review_mode"]) {
  if (mode === "fast") return 0.72;
  if (mode === "conservative") return 0.9;
  return 0.82;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  let body: { organization_id?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const organizationId = text(body.organization_id, 80);
  const answers: Answers = {
    business_description: text(body.answers?.business_description, 700),
    buyer_and_motion: text(body.answers?.buyer_and_motion, 500),
    call_goal: text(body.answers?.call_goal, 240),
    must_capture: textList(body.answers?.must_capture, 10, 100),
    custom_capture: text(body.answers?.custom_capture, 500),
    review_mode:
      body.answers?.review_mode === "fast" || body.answers?.review_mode === "conservative"
        ? body.answers.review_mode
        : "balanced",
  };
  if (!organizationId) return json({ error: "organization_id is required" }, 400);
  if (!answers.business_description || !answers.buyer_and_motion || !answers.call_goal) {
    return json({ error: "Complete the three required CRM setup questions first" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const [{ data: member }, { data: context }] = await Promise.all([
    admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userData.user.id)
      .maybeSingle(),
    admin
      .from("business_context")
      .select("identity,customer,motion")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (!member) return json({ error: "Forbidden" }, 403);
  if (!["owner", "admin"].includes(String(member.role))) {
    return json({ error: "Only workspace owners and admins can change CRM intelligence" }, 403);
  }

  const identity =
    context?.identity && typeof context.identity === "object"
      ? (context.identity as Record<string, unknown>)
      : {};
  const inferred = resolveSalesVertical(
    `${text(identity.industry)} ${answers.business_description}`,
    `${text(identity.niche)} ${answers.buyer_and_motion}`,
  );

  let raw: Record<string, unknown> = {};
  let generatedBy = "industry_template";
  try {
    const result = await callPAL(
      {
        systemPrompt: [
          "You design evidence-backed CRM extraction profiles for sales teams.",
          "Turn the short intake into the smallest useful field set for this exact sales motion.",
          "Never request secrets, full dates of birth, medical details, payment data, government IDs, or credit details for automatic CRM write-back.",
          "Restricted fields may be listed only so the system can detect and block them.",
          "Prefer concrete fields a rep would otherwise type after a call. Avoid generic vanity insights.",
        ].join("\n"),
        userPrompt: JSON.stringify({
          existing_business_context: context ?? {},
          questionnaire: answers,
          inferred_industry_template: inferred.label,
        }),
        tool: {
          name: "create_crm_intelligence_profile",
          description: "Create a tailored, compliance-aware post-call CRM extraction profile.",
          parameters: {
            type: "object",
            properties: {
              base_profile: {
                type: "string",
                enum: Object.keys(SALES_VERTICAL_PROFILES),
              },
              profile_label: { type: "string" },
              objective: { type: "string" },
              summary: { type: "string" },
              insight_questions: { type: "array", items: { type: "string" } },
              compliance_rules: { type: "array", items: { type: "string" } },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    description: { type: "string" },
                    entity: { type: "string", enum: ["lead", "contact"] },
                    required: { type: "boolean" },
                    sensitivity: {
                      type: "string",
                      enum: ["standard", "review", "restricted"],
                    },
                  },
                  required: ["key", "label", "description", "entity", "required", "sensitivity"],
                },
              },
            },
            required: [
              "base_profile",
              "profile_label",
              "objective",
              "summary",
              "insight_questions",
              "compliance_rules",
              "fields",
            ],
          },
        },
        maxTokens: 1800,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
      "starter",
      "crm-profile-builder",
      JSON.stringify(answers),
    );
    raw = result.toolResult ?? {};
    generatedBy = result.model;
  } catch (error) {
    console.warn(
      "[generate-crm-intelligence-profile] AI unavailable; using industry template",
      error instanceof Error ? error.message : error,
    );
  }

  const requestedBase = text(raw.base_profile, 30) as SalesVerticalKey;
  const baseKey: SalesVerticalKey =
    requestedBase in SALES_VERTICAL_PROFILES ? requestedBase : inferred.key;
  const base = SALES_VERTICAL_PROFILES[baseKey];
  const profile = {
    key: baseKey,
    label: text(raw.profile_label, 100) || `${base.label} sales`,
    aliases: base.aliases,
    objective: text(raw.objective, 500) || base.objective,
    insightQuestions: textList(raw.insight_questions, 8, 240).length
      ? textList(raw.insight_questions, 8, 240)
      : base.insightQuestions,
    complianceRules: [
      ...new Set([...base.complianceRules, ...textList(raw.compliance_rules, 12, 260)]),
    ],
    fields: normalizeFields(baseKey, raw.fields),
    summary:
      text(raw.summary, 500) ||
      `Bylda will capture ${base.label.toLowerCase()} qualification, next steps, and CRM-ready call evidence.`,
    autoWriteMinConfidence: confidenceFor(answers.review_mode),
    reviewMode: answers.review_mode,
    generatedBy,
  };

  const { data: saved, error: saveError } = await admin
    .from("crm_intelligence_profiles")
    .upsert(
      {
        organization_id: organizationId,
        created_by: userData.user.id,
        status: "active",
        questionnaire_answers: answers,
        generated_profile: profile,
        base_sales_profile: baseKey,
        auto_write_min_confidence: profile.autoWriteMinConfidence,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    )
    .select(
      "id,organization_id,status,generated_profile,base_sales_profile,auto_write_min_confidence,generated_at",
    )
    .single();
  if (saveError)
    return json({ error: `Could not save CRM intelligence: ${saveError.message}` }, 500);

  return json({ ok: true, profile: saved });
});
