/**
 * Bylda · Operator Client
 * All tool invocations and chat route through Supabase Edge Functions.
 * All AI runs via Claude through Supabase Edge Functions.
 */

import { supabase } from "@/integrations/supabase/client";
import { saveToMemory } from "./saveToMemory";

// ─── Operator state machine ──────────────────────────────────────────────────

export type OperatorState =
  | "idle"
  | "loading_context"
  | "awaiting_clarification"
  | "running_intake"
  | "running_strategy"
  | "running_specialist"
  | "output_ready"
  | "credit_insufficient"
  | "escalated"
  | "error";

// ─── Response envelope ───────────────────────────────────────────────────────

export type OperatorError = {
  success: false;
  error: string;
  code?: string;
  status?: number;
  upgrade_url?: string | null;
  upsell_message?: string | null;
  credits_remaining?: number;
};

export type OperatorSuccess<T = unknown> = {
  success: true;
  status: "success";
  tool_slug: string;
  formatted_output: string;
  raw_output: T;
  credits_used: number;
  credits_remaining: number;
  session_id: string;
  qa_score: number;
  timestamp: string;
};

export type OperatorResult<T = unknown> = OperatorSuccess<T> | OperatorError;

export type ClarificationResult = {
  success: true;
  status: "clarification_needed";
  question: string;
  session_id: string;
};

export type FullOperatorResult<T = unknown> = OperatorResult<T> | ClarificationResult;

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isSuccess<T>(r: FullOperatorResult<T>): r is OperatorSuccess<T> {
  return r.success === true && (r as OperatorSuccess<T>).status === "success";
}

export function isClarification(r: FullOperatorResult): r is ClarificationResult {
  return r.success === true && (r as ClarificationResult).status === "clarification_needed";
}

export function isError(r: FullOperatorResult): r is OperatorError {
  return r.success === false;
}

export function isCreditBlock(r: FullOperatorResult): boolean {
  return (
    isError(r) &&
    ((r as OperatorError).code === "CREDIT_INSUFFICIENT" ||
      (r as OperatorError).code === "QUOTA" ||
      (r as OperatorError).status === 402)
  );
}

export function isPlanGateBlock(r: FullOperatorResult): boolean {
  return (
    isError(r) &&
    ((r as OperatorError).code === "PLAN_UPGRADE_REQUIRED" ||
      (r as OperatorError).code === "PLAN_GATE" ||
      (r as OperatorError).status === 403)
  );
}

export function getUpgradeUrl(r: OperatorError): string {
  return r.upgrade_url ?? "/upgrade";
}

// ─── Core helpers ────────────────────────────────────────────────────────────

async function invokeTool<T = unknown>(
  toolKey: string,
  params: Record<string, unknown>,
): Promise<FullOperatorResult<T>> {
  const { data, error } = await supabase.functions.invoke("run-tool", {
    body: { toolKey, input: params },
  });

  if (error) {
    return {
      success: false,
      error: error.message ?? "Edge function error",
      code: "FUNCTION_ERROR",
    };
  }

  const body = (data ?? {}) as Record<string, unknown>;

  if (body["error"]) {
    return {
      success: false,
      error: body["error"] as string,
      code: body["code"] as string | undefined,
      status: body["status"] as number | undefined,
    };
  }

  return {
    success: true,
    status: "success",
    tool_slug: toolKey,
    formatted_output: JSON.stringify(body["output"] ?? body, null, 2),
    raw_output: (body["output"] ?? body) as T,
    credits_used: (body["credits_used"] as number) ?? 1,
    credits_remaining: (body["credits_remaining"] as number) ?? 999,
    session_id: (body["run_id"] as string) ?? crypto.randomUUID(),
    qa_score: 90,
    timestamp: new Date().toISOString(),
  };
}

async function invokeChat(
  message: string,
  session_id?: string,
  workspace_id?: string,
): Promise<FullOperatorResult> {
  const { data, error } = await supabase.functions.invoke("operator", {
    body: { message, session_id, workspace_id },
  });

  if (error) {
    return {
      success: false,
      error: error.message ?? "Operator error",
      code: "FUNCTION_ERROR",
    };
  }

  const body = (data ?? {}) as Record<string, unknown>;

  if (body["status"] === "credit_insufficient") {
    return {
      success: false,
      error: (body["upsell_message"] as string) ?? "Credit limit reached",
      code: "CREDIT_INSUFFICIENT",
      upgrade_url: "/app/billing",
      upsell_message: body["upsell_message"] as string | null,
      credits_remaining: 0,
    };
  }

  return {
    success: true,
    status: "success",
    tool_slug: "operator_chat",
    formatted_output: (body["reply"] as string) ?? "",
    raw_output: body,
    credits_used: (body["credits_used"] as number) ?? 1,
    credits_remaining: (body["credits_remaining"] as number) ?? 999,
    session_id: (body["session_id"] as string) ?? crypto.randomUUID(),
    qa_score: 90,
    timestamp: new Date().toISOString(),
  };
}

// ─── Credit cost reference ────────────────────────────────────────────────────

export const CREDIT_COSTS: Record<string, number> = {
  intake: 0,
  strategy: 20,
  blog: 10,
  social: 5,
  email_sequence: 12,
  sales_script: 8,
  ad_creative: 8,
  vsl: 15,
  landing_page: 10,
  cold_email: 12,
  automation: 25,
  client_report: 20,
  niche_validator: 20,
  icp: 20,
  offer: 20,
  pricing: 20,
  pitch_deck: 20,
  lead_magnet: 10,
};

// ─── Intake ──────────────────────────────────────────────────────────────────

export type IntakeParams = { raw_input: string };

export const runIntake = (
  _user_id: string,
  params: IntakeParams,
  _accessToken?: string,
  _session_id?: string,
) => invokeTool("intake", params);

// ─── Strategy ────────────────────────────────────────────────────────────────

export type StrategyParams = {
  focus_areas?: Array<"icp" | "offer" | "pricing" | "gtm" | "niche">;
};

export const runStrategy = (
  _user_id: string,
  params: StrategyParams = {},
  _accessToken?: string,
  _session_id?: string,
) => invokeTool("strategy", params);

// ─── Content tools ───────────────────────────────────────────────────────────

export type Platform = "linkedin" | "twitter" | "instagram" | "facebook" | "tiktok";

export type BlogParams = { topic: string; primary_keyword?: string };
export type SocialParams = { topic: string; platform: Platform; cta?: string };
export type EmailSequenceParams = {
  sequence_type: "nurture" | "sales" | "onboarding" | "re-engagement";
  topic: string;
  email_count?: number;
};
export type SalesScriptParams = {
  script_type:
    | "cold_call"
    | "discovery"
    | "closing"
    | "objection_handling"
    | "voicemail"
    | "follow_up";
  scenario_notes?: string;
};
export type AdCreativeParams = {
  offer: string;
  audience_pain: string;
  platform: "meta" | "google" | "linkedin";
};
export type VslParams = { product_summary: string; length_minutes?: number };
export type LandingPageParams = {
  offer: string;
  audience_awareness:
    | "unaware"
    | "problem_aware"
    | "solution_aware"
    | "product_aware"
    | "most_aware";
  primary_cta: string;
};
export type ColdEmailParams = {
  icp: string;
  offer: string;
  sender_name: string;
  sender_company: string;
};

export const runBlog = (_uid: string, params: BlogParams, _t?: string, _s?: string) =>
  invokeTool("blog", params);

export const runSocial = (_uid: string, params: SocialParams, _t?: string, _s?: string) =>
  invokeTool("social", params);

export const runEmailSequence = (
  _uid: string,
  params: EmailSequenceParams,
  _t?: string,
  _s?: string,
) => invokeTool("email_sequence", params);

export const runSalesScript = (_uid: string, params: SalesScriptParams, _t?: string, _s?: string) =>
  invokeTool("sales_script", params);

export const runAdCreative = (_uid: string, params: AdCreativeParams, _t?: string, _s?: string) =>
  invokeTool("ad_creative", params);

export const runVsl = (_uid: string, params: VslParams, _t?: string, _s?: string) =>
  invokeTool("vsl", params);

export const runLandingPage = (_uid: string, params: LandingPageParams, _t?: string, _s?: string) =>
  invokeTool("landing_page", params);

export const runColdEmail = (_uid: string, params: ColdEmailParams, _t?: string, _s?: string) =>
  invokeTool("cold_email", params);

// ─── Strategy sub-tools ──────────────────────────────────────────────────────

export type NicheValidatorParams = { niche_idea: string; geography?: string };
export type IcpParams = { niche: string; offer: string; current_customer_examples?: string };
export type OfferBuilderParams = {
  core_product: string;
  target_market: string;
  price_target?: number | string;
};
export type PricingParams = {
  business_model: string;
  offer_value_estimate: number | string;
  market_avg_price?: number | string;
};
export type PitchDeckParams = {
  company_name: string;
  problem: string;
  solution: string;
  traction?: string;
  ask_amount?: number | string;
  deck_type?: "seed" | "series_a" | "pre_seed";
};
export type LeadMagnetParams = {
  niche: string;
  icp_pain_point: string;
  format: "pdf_guide" | "checklist" | "template" | "video" | "email_course";
};

export const runNicheValidator = (
  _uid: string,
  params: NicheValidatorParams,
  _t?: string,
  _s?: string,
) => invokeTool("niche_validator", params);

export const runIcpBuilder = (_uid: string, params: IcpParams, _t?: string, _s?: string) =>
  invokeTool("icp", params);

export const runOfferBuilder = (
  _uid: string,
  params: OfferBuilderParams,
  _t?: string,
  _s?: string,
) => invokeTool("offer", params);

export const runPricingStrategist = (
  _uid: string,
  params: PricingParams,
  _t?: string,
  _s?: string,
) => invokeTool("pricing", params);

export const runPitchDeck = (_uid: string, params: PitchDeckParams, _t?: string, _s?: string) =>
  invokeTool("pitch_deck", params);

export const runLeadMagnet = (_uid: string, params: LeadMagnetParams, _t?: string, _s?: string) =>
  invokeTool("lead_magnet", params);

// ─── Automation ──────────────────────────────────────────────────────────────

export type AutomationParams = {
  process_description: string;
  integrations?: string[];
};

export const runAutomation = (_uid: string, params: AutomationParams, _t?: string, _s?: string) =>
  invokeTool("automation", params);

// ─── Client Reporting ────────────────────────────────────────────────────────

export type ClientReportParams = {
  client_id: string;
  period_start: string;
  period_end: string;
  period_label?: string;
};

export const runClientReport = (
  _uid: string,
  params: ClientReportParams,
  _t?: string,
  _s?: string,
) => invokeTool("client_report", params);

// ─── Free-text operator chat ─────────────────────────────────────────────────

export const sendMessage = (
  _user_id: string,
  message: string,
  _accessToken?: string,
  session_id?: string,
) => invokeChat(message, session_id);

// ─── Mentor Agent ─────────────────────────────────────────────────────────────

export type MentorAgentId = "growth" | "offer" | "sales" | "content" | "automation" | "finance";

export type MentorAgentParams = {
  agent_id: MentorAgentId;
  message: string;
  org_id: string;
  business_context?: string;
};

export type MentorAgentResult = {
  success: boolean;
  response?: string;
  agent_id?: string;
  session_id?: string;
  error?: string;
};

export const MENTOR_CREDIT_COST = 3;

export async function runMentorAgent(
  user_id: string,
  params: MentorAgentParams,
  _accessToken?: string,
  session_id?: string,
): Promise<MentorAgentResult> {
  const { data, error } = await supabase.functions.invoke("operator", {
    body: {
      message: params.message,
      agent_id: params.agent_id,
      org_id: params.org_id,
      business_context: params.business_context,
      session_id,
    },
  });

  if (error) {
    return { success: false, error: error.message ?? "Mentor agent error" };
  }

  const result = (data ?? { success: false, error: "No response" }) as MentorAgentResult;

  if (result.success && result.response && user_id && params.org_id) {
    saveToMemory({
      orgId: params.org_id,
      userId: user_id,
      toolName: `mentor-${params.agent_id}`,
      input: params.message,
      output: result.response,
    });
  }

  return result;
}
