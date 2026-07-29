// TASK-081 · Standardized Operator Response Contract
// All AI operator calls — whether via edge function or direct — return this shape.
// Type guards let callers discriminate without casting.

import type { Lane } from "./lane-classifier";

// ── Request ───────────────────────────────────────────────────────────

export interface OperatorRequest {
  message: string;
  workspace_id?: string;
  mission_id?: string;
  lane?: Lane;
  context?: OperatorContext;
  session_id?: string;
}

// ── Context Payload (assembled by agent-context.ts) ───────────────────

export interface OperatorContext {
  user_id: string;
  workspace_id?: string;
  organization_id?: string;
  lane?: Lane;
  stage?: string;
  current_mission?: {
    id: string;
    title: string;
    description?: string;
    step_count: number;
    completed_steps: number;
  };
  recent_tool_runs?: Array<{
    tool_key: string;
    status: string;
    created_at: string;
  }>;
  plan?: string;
  credits_remaining?: number;
  profile?: {
    full_name?: string;
    idea?: string;
    challenge?: string;
  };
}

// ── Response variants ─────────────────────────────────────────────────

export type OperatorResponseStatus =
  | "success"
  | "clarification_needed"
  | "credit_insufficient"
  | "plan_gate"
  | "error";

export interface OperatorSuccessResponse {
  status: "success";
  session_id: string;
  agent_run_id?: string;
  reply: string; // human-readable markdown reply
  tool_key?: string; // if a tool was dispatched
  tool_output?: Record<string, unknown>; // raw tool output
  formatted_output?: string; // rendered markdown of tool output
  credits_used: number;
  credits_remaining: number;
  qa_score?: number; // 0–100 confidence from QA agent
  suggested_next?: string[]; // tool keys or action slugs to suggest
}

export interface OperatorClarificationResponse {
  status: "clarification_needed";
  session_id: string;
  question: string;
  options?: string[];
}

export interface OperatorCreditResponse {
  status: "credit_insufficient";
  credits_remaining: number;
  credits_needed: number;
  upgrade_url: string;
  upsell_message: string;
}

export interface OperatorPlanGateResponse {
  status: "plan_gate";
  feature: string;
  required_plan: string;
  current_plan: string;
  upgrade_url: string;
  upsell_message: string;
}

export interface OperatorErrorResponse {
  status: "error";
  error: string;
  code?: string;
  session_id?: string;
}

export type OperatorResponse =
  | OperatorSuccessResponse
  | OperatorClarificationResponse
  | OperatorCreditResponse
  | OperatorPlanGateResponse
  | OperatorErrorResponse;

// ── Type guards ───────────────────────────────────────────────────────

export function isSuccess(r: OperatorResponse): r is OperatorSuccessResponse {
  return r.status === "success";
}

export function isClarification(r: OperatorResponse): r is OperatorClarificationResponse {
  return r.status === "clarification_needed";
}

export function isCreditBlock(r: OperatorResponse): r is OperatorCreditResponse {
  return r.status === "credit_insufficient";
}

export function isPlanGate(r: OperatorResponse): r is OperatorPlanGateResponse {
  return r.status === "plan_gate";
}

export function isError(r: OperatorResponse): r is OperatorErrorResponse {
  return r.status === "error";
}

// ── Agent run state machine ────────────────────────────────────────────

export type AgentRunState =
  | "idle"
  | "loading_context"
  | "running"
  | "awaiting_clarification"
  | "success"
  | "error"
  | "credit_insufficient";

// ── Prompt template types (TASK-084) ──────────────────────────────────

export interface PromptContext {
  lane: Lane;
  stage: string;
  mission_title?: string;
  user_name?: string;
  idea?: string;
  plan?: string;
}

export interface PromptTemplate {
  system: string;
  user: (input: Record<string, unknown>, ctx: PromptContext) => string;
}
