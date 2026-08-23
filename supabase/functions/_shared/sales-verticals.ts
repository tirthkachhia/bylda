export type SalesVerticalKey =
  | "generic"
  | "b2b_saas"
  | "solar"
  | "insurance"
  | "real_estate"
  | "home_services";

export type FieldSensitivity = "standard" | "review" | "restricted";

export type VerticalFieldSpec = {
  key: string;
  label: string;
  description: string;
  crmTarget: string;
  required?: boolean;
  sensitivity?: FieldSensitivity;
};

export type SalesVerticalProfile = {
  key: SalesVerticalKey;
  label: string;
  aliases: string[];
  objective: string;
  insightQuestions: string[];
  complianceRules: string[];
  fields: VerticalFieldSpec[];
  autoWriteMinConfidence?: number;
};

export type ExtractedVerticalField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  evidence_quote: string;
};

export type CrmWritebackCandidate = ExtractedVerticalField & {
  crm_target: string;
  eligible: boolean;
  reason: string;
};

const COMMON_FIELDS: VerticalFieldSpec[] = [
  {
    key: "call_outcome",
    label: "Call outcome",
    description: "The concrete outcome of this call.",
    crmTarget: "lead.custom_fields.bylda_call_outcome",
    required: true,
  },
  {
    key: "deal_stage",
    label: "Deal stage",
    description: "The best supported current pipeline stage.",
    crmTarget: "lead.stage",
    required: true,
  },
  {
    key: "next_step",
    label: "Next step",
    description: "The agreed action, owner, and date when stated.",
    crmTarget: "lead.custom_fields.bylda_next_step",
    required: true,
  },
  {
    key: "decision_timeline",
    label: "Decision timeline",
    description: "When the buyer expects to decide, buy, renew, or install.",
    crmTarget: "lead.custom_fields.bylda_decision_timeline",
  },
  {
    key: "primary_objection",
    label: "Primary objection",
    description: "The most important unresolved concern in the buyer's words.",
    crmTarget: "lead.custom_fields.bylda_primary_objection",
  },
];

const profile = (
  input: Omit<SalesVerticalProfile, "fields"> & { fields: VerticalFieldSpec[] },
): SalesVerticalProfile => ({ ...input, fields: [...COMMON_FIELDS, ...input.fields] });

export const SALES_VERTICAL_PROFILES: Record<SalesVerticalKey, SalesVerticalProfile> = {
  generic: profile({
    key: "generic",
    label: "General sales",
    aliases: [],
    objective: "Qualify the buyer, identify the buying process, and preserve the agreed next step.",
    insightQuestions: [
      "Why will this deal move forward?",
      "What could stop it?",
      "Who decides and what happens next?",
    ],
    complianceRules: ["Do not infer facts that were not stated in the transcript or CRM context."],
    fields: [
      {
        key: "budget",
        label: "Budget",
        description: "Budget amount or range explicitly discussed.",
        crmTarget: "lead.value",
      },
      {
        key: "decision_maker",
        label: "Decision maker",
        description: "Person or role with purchasing authority.",
        crmTarget: "lead.custom_fields.bylda_decision_maker",
      },
      {
        key: "business_need",
        label: "Business need",
        description: "The problem and measurable impact the buyer wants solved.",
        crmTarget: "lead.custom_fields.bylda_business_need",
      },
    ],
  }),
  b2b_saas: profile({
    key: "b2b_saas",
    label: "B2B SaaS",
    aliases: ["saas", "software", "b2b software", "technology", "tech"],
    objective:
      "Evaluate technical fit, business impact, buying authority, and implementation risk.",
    insightQuestions: [
      "What measurable workflow or revenue problem is being solved?",
      "Which stakeholders, integrations, security reviews, and competitors affect the deal?",
      "What proof is needed to reach the next stage?",
    ],
    complianceRules: [
      "Do not claim integrations, security controls, or implementation dates not stated.",
    ],
    fields: [
      {
        key: "use_case",
        label: "Use case",
        description: "Primary workflow or job to be done.",
        crmTarget: "lead.custom_fields.bylda_use_case",
        required: true,
      },
      {
        key: "current_stack",
        label: "Current stack",
        description: "Tools or systems the buyer currently uses.",
        crmTarget: "lead.custom_fields.bylda_current_stack",
      },
      {
        key: "integration_requirements",
        label: "Integration requirements",
        description: "Required systems and data flows.",
        crmTarget: "lead.custom_fields.bylda_integration_requirements",
      },
      {
        key: "security_requirements",
        label: "Security requirements",
        description: "Security, legal, or procurement requirements.",
        crmTarget: "lead.custom_fields.bylda_security_requirements",
        sensitivity: "review",
      },
      {
        key: "seats",
        label: "Seats",
        description: "Expected users or licenses.",
        crmTarget: "lead.custom_fields.bylda_seats",
      },
      {
        key: "budget",
        label: "Budget",
        description: "Budget amount or range explicitly discussed.",
        crmTarget: "lead.value",
      },
      {
        key: "competitor",
        label: "Competitor",
        description: "Alternative product under consideration.",
        crmTarget: "lead.custom_fields.bylda_competitor",
      },
    ],
  }),
  solar: profile({
    key: "solar",
    label: "Residential solar",
    aliases: ["solar", "solar sales", "residential solar", "pv", "photovoltaic"],
    objective:
      "Determine homeowner and property fit, energy economics, financing preference, and the next site-design step.",
    insightQuestions: [
      "Is this property and homeowner eligible for a solar evaluation?",
      "What energy-cost, roof, shading, financing, or timeline constraints affect the project?",
      "What must be verified before presenting savings or incentives?",
    ],
    complianceRules: [
      "Never present estimated savings, production, tax credits, or incentives as guaranteed.",
      "Flag utility, roof, ownership, and financing claims that still require verification.",
      "Never auto-write utility account numbers, government identifiers, or payment details.",
    ],
    fields: [
      {
        key: "homeowner_status",
        label: "Homeowner status",
        description: "Whether the prospect owns the property and can authorize work.",
        crmTarget: "contact.custom_fields.solar_homeowner_status",
        required: true,
      },
      {
        key: "property_address",
        label: "Property address",
        description: "Installation property address when explicitly stated.",
        crmTarget: "contact.custom_fields.solar_property_address",
        sensitivity: "review",
      },
      {
        key: "utility_provider",
        label: "Utility provider",
        description: "Electric utility serving the property.",
        crmTarget: "contact.custom_fields.solar_utility_provider",
        required: true,
      },
      {
        key: "monthly_electric_bill",
        label: "Monthly electric bill",
        description: "Typical bill amount or range.",
        crmTarget: "lead.custom_fields.solar_monthly_bill",
        required: true,
      },
      {
        key: "annual_usage_kwh",
        label: "Annual usage",
        description: "Annual electricity usage in kWh when stated.",
        crmTarget: "lead.custom_fields.solar_annual_usage_kwh",
      },
      {
        key: "roof_type",
        label: "Roof type",
        description: "Roof material or construction.",
        crmTarget: "lead.custom_fields.solar_roof_type",
      },
      {
        key: "roof_age",
        label: "Roof age",
        description: "Approximate roof age or replacement status.",
        crmTarget: "lead.custom_fields.solar_roof_age",
      },
      {
        key: "shading",
        label: "Shading",
        description: "Trees, obstructions, or shade concerns.",
        crmTarget: "lead.custom_fields.solar_shading",
      },
      {
        key: "battery_interest",
        label: "Battery interest",
        description: "Interest in storage or backup power.",
        crmTarget: "lead.custom_fields.solar_battery_interest",
      },
      {
        key: "financing_preference",
        label: "Financing preference",
        description: "Cash, loan, lease, or undecided.",
        crmTarget: "lead.custom_fields.solar_financing_preference",
        sensitivity: "review",
      },
      {
        key: "credit_details",
        label: "Credit details",
        description: "Any credit score, credit band, or financing qualification detail.",
        crmTarget: "blocked.credit_details",
        sensitivity: "restricted",
      },
      {
        key: "utility_account_number",
        label: "Utility account number",
        description: "Utility account identifier.",
        crmTarget: "blocked.utility_account_number",
        sensitivity: "restricted",
      },
      {
        key: "site_survey_status",
        label: "Site survey",
        description: "Scheduled or required site survey/design appointment.",
        crmTarget: "lead.custom_fields.solar_site_survey_status",
      },
    ],
  }),
  insurance: profile({
    key: "insurance",
    label: "Insurance",
    aliases: [
      "insurance",
      "life insurance",
      "health insurance",
      "auto insurance",
      "home insurance",
      "p&c",
      "property and casualty",
    ],
    objective:
      "Capture coverage needs, eligibility context, renewal timing, and an appropriate licensed follow-up without storing restricted personal data.",
    insightQuestions: [
      "What risk or coverage gap is the prospect trying to solve?",
      "Which policy type, state, current coverage, renewal date, and decision factors matter?",
      "Which statements require licensed-agent review or a formal application?",
    ],
    complianceRules: [
      "Do not recommend a specific policy as suitable unless a licensed review supports it.",
      "Do not treat quoted premiums, eligibility, or coverage as guaranteed.",
      "Never auto-write SSNs, full dates of birth, medical details, payment data, or government identifiers.",
    ],
    fields: [
      {
        key: "line_of_business",
        label: "Insurance type",
        description: "Life, health, auto, home, commercial, or another line.",
        crmTarget: "lead.custom_fields.insurance_line",
        required: true,
      },
      {
        key: "coverage_need",
        label: "Coverage need",
        description: "Risk, asset, person, or coverage gap the buyer wants addressed.",
        crmTarget: "lead.custom_fields.insurance_coverage_need",
        required: true,
      },
      {
        key: "state",
        label: "State",
        description: "State where coverage or licensing applies.",
        crmTarget: "contact.custom_fields.insurance_state",
        required: true,
      },
      {
        key: "current_carrier",
        label: "Current carrier",
        description: "Current insurance carrier when stated.",
        crmTarget: "lead.custom_fields.insurance_current_carrier",
      },
      {
        key: "renewal_date",
        label: "Renewal date",
        description: "Policy expiration or renewal date.",
        crmTarget: "lead.custom_fields.insurance_renewal_date",
      },
      {
        key: "current_premium",
        label: "Current premium",
        description: "Current premium amount and frequency.",
        crmTarget: "lead.custom_fields.insurance_current_premium",
        sensitivity: "review",
      },
      {
        key: "coverage_amount",
        label: "Coverage amount",
        description: "Existing or requested limit or benefit amount.",
        crmTarget: "lead.custom_fields.insurance_coverage_amount",
        sensitivity: "review",
      },
      {
        key: "decision_factors",
        label: "Decision factors",
        description: "Price, deductible, exclusions, service, or other priorities.",
        crmTarget: "lead.custom_fields.insurance_decision_factors",
      },
      {
        key: "licensed_follow_up",
        label: "Licensed follow-up",
        description: "Required licensed-agent review or application appointment.",
        crmTarget: "lead.custom_fields.insurance_licensed_follow_up",
        required: true,
      },
      {
        key: "date_of_birth",
        label: "Date of birth",
        description: "Any full or partial date of birth.",
        crmTarget: "blocked.date_of_birth",
        sensitivity: "restricted",
      },
      {
        key: "ssn",
        label: "SSN",
        description: "Any Social Security number.",
        crmTarget: "blocked.ssn",
        sensitivity: "restricted",
      },
      {
        key: "medical_details",
        label: "Medical details",
        description: "Health condition, treatment, medication, or diagnosis details.",
        crmTarget: "blocked.medical_details",
        sensitivity: "restricted",
      },
      {
        key: "payment_details",
        label: "Payment details",
        description: "Bank or card data.",
        crmTarget: "blocked.payment_details",
        sensitivity: "restricted",
      },
    ],
  }),
  real_estate: profile({
    key: "real_estate",
    label: "Real estate",
    aliases: ["real estate", "realtor", "brokerage", "property sales"],
    objective:
      "Qualify motivation, property criteria, financing readiness, representation, and showing or listing next steps.",
    insightQuestions: [
      "Why is the client moving now?",
      "What property, financing, and timing constraints matter?",
      "What action advances the transaction?",
    ],
    complianceRules: [
      "Do not infer protected-class preferences or generate discriminatory housing guidance.",
    ],
    fields: [
      {
        key: "client_type",
        label: "Client type",
        description: "Buyer, seller, landlord, tenant, or investor.",
        crmTarget: "lead.custom_fields.real_estate_client_type",
        required: true,
      },
      {
        key: "motivation",
        label: "Motivation",
        description: "Reason for buying, selling, or moving.",
        crmTarget: "lead.custom_fields.real_estate_motivation",
      },
      {
        key: "target_area",
        label: "Target area",
        description: "Requested market or location.",
        crmTarget: "lead.custom_fields.real_estate_target_area",
      },
      {
        key: "price_range",
        label: "Price range",
        description: "Purchase, rent, or listing price range.",
        crmTarget: "lead.value",
      },
      {
        key: "financing_status",
        label: "Financing status",
        description: "Cash, pre-approved, lender needed, or unknown.",
        crmTarget: "lead.custom_fields.real_estate_financing_status",
        sensitivity: "review",
      },
      {
        key: "representation_status",
        label: "Representation",
        description: "Whether the client is represented by another agent.",
        crmTarget: "lead.custom_fields.real_estate_representation_status",
      },
      {
        key: "showing_or_listing_step",
        label: "Next appointment",
        description: "Showing, consultation, valuation, or listing appointment.",
        crmTarget: "lead.custom_fields.real_estate_next_appointment",
        required: true,
      },
    ],
  }),
  home_services: profile({
    key: "home_services",
    label: "Home services",
    aliases: ["roofing", "hvac", "plumbing", "electrical", "home improvement", "contractor"],
    objective:
      "Qualify the property issue, urgency, ownership, access, estimate scope, and appointment.",
    insightQuestions: [
      "What is broken or being improved?",
      "How urgent and qualified is the job?",
      "What must happen before an estimate can be accepted?",
    ],
    complianceRules: [
      "Do not present an estimate, diagnosis, permit status, or warranty as final before inspection.",
    ],
    fields: [
      {
        key: "service_type",
        label: "Service type",
        description: "Requested trade or service.",
        crmTarget: "lead.custom_fields.home_service_type",
        required: true,
      },
      {
        key: "property_issue",
        label: "Property issue",
        description: "Observed problem or desired project.",
        crmTarget: "lead.custom_fields.home_property_issue",
        required: true,
      },
      {
        key: "urgency",
        label: "Urgency",
        description: "Emergency, near-term, planned, or exploratory.",
        crmTarget: "lead.custom_fields.home_urgency",
      },
      {
        key: "property_owner",
        label: "Property owner",
        description: "Whether the prospect can authorize work.",
        crmTarget: "contact.custom_fields.home_property_owner",
      },
      {
        key: "property_address",
        label: "Property address",
        description: "Service location when stated.",
        crmTarget: "contact.custom_fields.home_property_address",
        sensitivity: "review",
      },
      {
        key: "estimate_range",
        label: "Estimate range",
        description: "Non-final price range discussed.",
        crmTarget: "lead.value",
        sensitivity: "review",
      },
      {
        key: "inspection_appointment",
        label: "Inspection appointment",
        description: "Scheduled inspection or estimate visit.",
        crmTarget: "lead.custom_fields.home_inspection_appointment",
        required: true,
      },
    ],
  }),
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveSalesVertical(industry: unknown, niche?: unknown): SalesVerticalProfile {
  const haystack = `${clean(industry)} ${clean(niche)}`.trim();
  if (!haystack) return SALES_VERTICAL_PROFILES.generic;
  for (const key of Object.keys(SALES_VERTICAL_PROFILES) as SalesVerticalKey[]) {
    if (key === "generic") continue;
    const candidate = SALES_VERTICAL_PROFILES[key];
    if (candidate.aliases.some((alias) => haystack.includes(alias))) return candidate;
  }
  return SALES_VERTICAL_PROFILES.generic;
}

/**
 * Safely hydrate an organization-specific profile saved by the CRM setup
 * questionnaire. Invalid or incomplete JSON falls back to the proven static
 * industry template; callers never execute model-provided targets blindly.
 */
export function hydrateSalesVerticalProfile(
  value: unknown,
  fallback: SalesVerticalProfile,
): SalesVerticalProfile {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const allowedBaseTargets = new Set(fallback.fields.map((field) => field.crmTarget));
  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .filter((field): field is Record<string, unknown> =>
          Boolean(field && typeof field === "object"),
        )
        .map((field) => {
          const key = typeof field.key === "string" ? field.key.trim() : "";
          const label = typeof field.label === "string" ? field.label.trim() : "";
          const description = typeof field.description === "string" ? field.description.trim() : "";
          const crmTarget = typeof field.crmTarget === "string" ? field.crmTarget.trim() : "";
          const sensitivity: FieldSensitivity =
            field.sensitivity === "restricted" || field.sensitivity === "review"
              ? field.sensitivity
              : "standard";
          const allowedTarget =
            allowedBaseTargets.has(crmTarget) ||
            /^lead\.custom_fields\.bylda_[a-z0-9_]+$/.test(crmTarget) ||
            /^contact\.custom_fields\.bylda_[a-z0-9_]+$/.test(crmTarget) ||
            /^blocked\.[a-z0-9_]+$/.test(crmTarget);
          if (!key || !label || !description || !allowedTarget) return null;
          return {
            key,
            label,
            description,
            crmTarget,
            required: Boolean(field.required),
            sensitivity,
          } satisfies VerticalFieldSpec;
        })
        .filter((field): field is VerticalFieldSpec => field !== null)
    : [];
  if (fields.length < 3) return fallback;

  const stringList = (candidate: unknown, original: string[]) => {
    const result = Array.isArray(candidate)
      ? candidate
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 12)
      : [];
    return result.length ? result : original;
  };
  const threshold = Number(raw.autoWriteMinConfidence);
  return {
    key: fallback.key,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : fallback.label,
    aliases: fallback.aliases,
    objective:
      typeof raw.objective === "string" && raw.objective.trim()
        ? raw.objective.trim()
        : fallback.objective,
    insightQuestions: stringList(raw.insightQuestions, fallback.insightQuestions),
    complianceRules: [
      ...new Set([...fallback.complianceRules, ...stringList(raw.complianceRules, [])]),
    ],
    fields,
    autoWriteMinConfidence: Number.isFinite(threshold)
      ? Math.max(0.5, Math.min(1, threshold))
      : fallback.autoWriteMinConfidence,
  };
}

export function buildVerticalExtractionTool(vertical: SalesVerticalProfile) {
  return {
    name: "record_call_insights",
    description: `Record evidence-backed ${vertical.label} sales insights and CRM field candidates.`,
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence factual call summary." },
        sentiment_score: { type: "number", description: "Prospect sentiment from -1 to 1." },
        talk_ratio: {
          type: "number",
          description: "Estimated fraction of talk time by the rep, 0 to 1.",
        },
        objections: { type: "array", items: { type: "string" } },
        competitor_mentions: { type: "array", items: { type: "string" } },
        next_steps_extracted: { type: "array", items: { type: "string" } },
        deal_insights: {
          type: "object",
          properties: {
            qualification_reason: { type: "string" },
            primary_driver: { type: "string" },
            primary_risk: { type: "string" },
            coaching_note: { type: "string" },
          },
          required: ["qualification_reason", "primary_driver", "primary_risk", "coaching_note"],
        },
        vertical_fields: {
          type: "array",
          description:
            "Only include a field when its value is directly supported by the transcript or supplied CRM context.",
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: vertical.fields.map((field) => field.key) },
              value: { type: "string" },
              confidence: { type: "number", description: "0 to 1 confidence in this exact value." },
              evidence_quote: {
                type: "string",
                description: "Short verbatim supporting quote from the transcript.",
              },
            },
            required: ["key", "value", "confidence", "evidence_quote"],
          },
        },
        compliance_flags: { type: "array", items: { type: "string" } },
      },
      required: [
        "summary",
        "objections",
        "competitor_mentions",
        "next_steps_extracted",
        "deal_insights",
        "vertical_fields",
        "compliance_flags",
      ],
    },
  };
}

export function buildVerticalSystemPrompt(vertical: SalesVerticalProfile) {
  return [
    `You are a ${vertical.label} sales conversation-intelligence analyst.`,
    vertical.objective,
    "Extract only what the transcript or labeled CRM context supports. Never guess missing values.",
    "Every vertical field must include a short transcript quote and calibrated confidence.",
    `Questions to answer: ${vertical.insightQuestions.join(" ")}`,
    `Rules: ${vertical.complianceRules.join(" ")}`,
  ].join("\n");
}

const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

export function normalizeVerticalFields(
  vertical: SalesVerticalProfile,
  value: unknown,
): ExtractedVerticalField[] {
  if (!Array.isArray(value)) return [];
  const specs = new Map(vertical.fields.map((field) => [field.key, field]));
  const found = new Set<string>();
  const result: ExtractedVerticalField[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const key = typeof item.key === "string" ? item.key : "";
    const spec = specs.get(key);
    const fieldValue = typeof item.value === "string" ? item.value.trim() : "";
    const evidence = typeof item.evidence_quote === "string" ? item.evidence_quote.trim() : "";
    const confidence = Math.max(0, Math.min(1, Number(item.confidence)));
    if (!spec || found.has(key) || !fieldValue || !evidence || !Number.isFinite(confidence))
      continue;
    found.add(key);
    result.push({
      key,
      label: spec.label,
      value: fieldValue,
      confidence,
      evidence_quote: evidence,
    });
  }
  return result;
}

export function buildCrmWritebackPreview(
  vertical: SalesVerticalProfile,
  fields: ExtractedVerticalField[],
): CrmWritebackCandidate[] {
  const specs = new Map(vertical.fields.map((field) => [field.key, field]));
  const minimumConfidence = vertical.autoWriteMinConfidence ?? 0.82;
  return fields.map((field) => {
    const spec = specs.get(field.key)!;
    const sensitivity = spec.sensitivity ?? "standard";
    const eligible = sensitivity === "standard" && field.confidence >= minimumConfidence;
    const reason =
      sensitivity === "restricted"
        ? "Blocked: restricted personal or financial data"
        : sensitivity === "review"
          ? "Manual review required"
          : field.confidence < minimumConfidence
            ? `Manual review required: confidence below ${Math.round(minimumConfidence * 100)}%`
            : "Eligible after write-back approval";
    return { ...field, crm_target: spec.crmTarget, eligible, reason };
  });
}

export function missingRequiredFields(
  vertical: SalesVerticalProfile,
  fields: ExtractedVerticalField[],
) {
  const present = new Set(fields.map((field) => field.key));
  return vertical.fields
    .filter((field) => field.required && !present.has(field.key))
    .map((field) => field.key);
}

export function normalizeCallExtraction(
  vertical: SalesVerticalProfile,
  raw: Record<string, unknown>,
) {
  const fields = normalizeVerticalFields(vertical, raw.vertical_fields);
  const deal =
    raw.deal_insights && typeof raw.deal_insights === "object"
      ? (raw.deal_insights as Record<string, unknown>)
      : {};
  return {
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    sentiment_score:
      typeof raw.sentiment_score === "number"
        ? Math.max(-1, Math.min(1, raw.sentiment_score))
        : null,
    talk_ratio:
      typeof raw.talk_ratio === "number" ? Math.max(0, Math.min(1, raw.talk_ratio)) : null,
    objections: stringArray(raw.objections),
    competitor_mentions: stringArray(raw.competitor_mentions),
    next_steps_extracted: stringArray(raw.next_steps_extracted),
    deal_insights: {
      qualification_reason:
        typeof deal.qualification_reason === "string" ? deal.qualification_reason.trim() : "",
      primary_driver: typeof deal.primary_driver === "string" ? deal.primary_driver.trim() : "",
      primary_risk: typeof deal.primary_risk === "string" ? deal.primary_risk.trim() : "",
      coaching_note: typeof deal.coaching_note === "string" ? deal.coaching_note.trim() : "",
    },
    fields,
    compliance_flags: stringArray(raw.compliance_flags),
    missing_required_fields: missingRequiredFields(vertical, fields),
    crm_writeback_preview: buildCrmWritebackPreview(vertical, fields),
  };
}

export function filterCrmContext(vertical: SalesVerticalProfile, value: unknown) {
  if (!value || typeof value !== "object") return {};
  const allowed = new Set(
    vertical.fields.filter((field) => field.sensitivity !== "restricted").map((field) => field.key),
  );
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => allowed.has(key)),
  );
}
