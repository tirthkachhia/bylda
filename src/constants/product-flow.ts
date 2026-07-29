// Bylda Launchpad · Product Flow Specification
// TASK-001 v1 activation event
// TASK-002 v2 activation event
// TASK-003 core value loop
// TASK-004 four primary user lanes
// TASK-005 stage map
// TASK-006 success conditions
// TASK-007 failure conditions
// TASK-008 screen → desired action
// TASK-009 checklist → activation behaviour
// TASK-010 non-core tool visibility rules

import type { Lane } from "@/lib/lane-classifier";

// ── TASK-001 · V1 Activation Event ───────────────────────────────────
// The single moment that proves the user got value.
// Trigger:  User completes onboarding and runs their first AI tool.
// Action:   Log 'first_tool_run' to activation_events.
// Output:   User is counted as "activated" in analytics.
export const V1_ACTIVATION_EVENT = "first_tool_run" as const;

// ── TASK-002 · V2 Activation Event ───────────────────────────────────
// Deeper activation that predicts retention.
// Trigger:  User completes their first mission (all steps done).
// Action:   Log 'first_mission_completed' to activation_events.
// Output:   User is counted as "retained" in analytics.
export const V2_ACTIVATION_EVENT = "first_mission_completed" as const;

// ── TASK-003 · Core Value Loop ────────────────────────────────────────
// "Founders enter their idea → Bylda assigns a mission →
//  they complete it with AI tools → measurable business progress repeats."
export const CORE_VALUE_LOOP =
  "Founders enter their idea, Bylda assigns a mission, they complete it with AI, and see measurable business progress every week.";

// ── TASK-004 · Four Primary User Lanes ───────────────────────────────
export const USER_LANES: Record<Lane, { label: string; goal: string; firstMission: string }> = {
  Idea: {
    label: "Idea Explorer",
    goal: "Validate and sharpen the concept before building anything.",
    firstMission: "Validate Your Idea",
  },
  Offer: {
    label: "Offer Builder",
    goal: "Define, package, and price the core offer.",
    firstMission: "Build Your Core Offer",
  },
  Customer: {
    label: "Customer Hunter",
    goal: "Land the first 10 paying customers.",
    firstMission: "Land Your First 10 Customers",
  },
  Systems: {
    label: "Systems Operator",
    goal: "Automate delivery and build a repeatable growth engine.",
    firstMission: "Launch Your GTM System",
  },
};

// ── TASK-005 · Stage Map ──────────────────────────────────────────────
// Full journey from awareness to weekly growth loop.
export const STAGE_MAP = [
  { stage: "Awareness", action: "User discovers Bylda via content / referral" },
  { stage: "Sign-up", action: "User creates account (email/OAuth)" },
  { stage: "Onboard", action: "User completes 3-step wizard → lane assigned" },
  { stage: "First Mission", action: "Bylda assigns mission; user starts Step 1" },
  { stage: "First AI Output", action: "User runs first tool → sees generated result" },
  { stage: "Mission Done", action: "User completes all mission steps (V2 event)" },
  { stage: "Next Mission", action: "Bylda assigns next mission; loop continues" },
  { stage: "Weekly Loop", action: "User returns weekly, completes missions, upgrades plan" },
] as const;

// ── TASK-006 · Success Condition Per Stage ────────────────────────────
export const STAGE_SUCCESS: Record<string, string> = {
  Awareness: "User clicks CTA and lands on sign-up page",
  "Sign-up": "User confirms email and profile is created",
  Onboard: "onboarding_complete = true and workspace created",
  "First Mission": "Mission status = active; first step unlocked",
  "First AI Output": "tool_run status = succeeded; output rendered",
  "Mission Done": "All mission_steps status = completed",
  "Next Mission": "New mission assigned with sort_order incremented",
  "Weekly Loop": "User returns within 7 days and runs ≥1 tool",
};

// ── TASK-007 · Failure / Drop-Off Condition Per Stage ─────────────────
export const STAGE_FAILURE: Record<string, string> = {
  Awareness: "User bounces without clicking CTA",
  "Sign-up": "User abandons form or doesn't verify email within 24h",
  Onboard: "User exits wizard before step 3 or workspace creation fails",
  "First Mission": "User views mission but doesn't start Step 1 within 30 min",
  "First AI Output": "Tool run fails (status = failed) or output is empty",
  "Mission Done": "≥1 step remains pending after 7 days",
  "Next Mission": "No new mission assigned within 1h of completing previous one",
  "Weekly Loop": "User does not return within 7 days → trigger nudge workflow",
};

// ── TASK-008 · Screen → Desired User Action ───────────────────────────
export const SCREEN_ACTIONS: Array<{ screen: string; desiredAction: string }> = [
  { screen: "Landing page", desiredAction: "Click 'Start free' CTA" },
  { screen: "Sign-up form", desiredAction: "Submit email + password" },
  { screen: "Onboarding step 1", desiredAction: "Enter name + idea description" },
  { screen: "Onboarding step 2", desiredAction: "Select business stage" },
  { screen: "Onboarding step 3", desiredAction: "Select biggest challenge" },
  { screen: "Welcome / boot screen", desiredAction: "Wait for auto-redirect to dashboard" },
  { screen: "Dashboard", desiredAction: "Click 'Start mission' on Current Mission card" },
  { screen: "Mission detail", desiredAction: "Click 'Run tool' on first mission step" },
  { screen: "Tool run page", desiredAction: "Submit tool input and view output" },
  { screen: "Generated asset", desiredAction: "Download or copy output; mark step done" },
  { screen: "Mission complete", desiredAction: "Click 'Start next mission'" },
  { screen: "Billing / paywall", desiredAction: "Click 'Upgrade plan'" },
];

// ── TASK-009 · Checklist Item → Activation Behaviour ─────────────────
export const CHECKLIST_ACTIVATIONS: Array<{ item: string; event: string }> = [
  {
    item: "Complete onboarding",
    event: V1_ACTIVATION_EVENT === "first_tool_run" ? "onboarding_complete" : "onboarding_complete",
  },
  { item: "Create first workspace", event: "workspace_created" },
  { item: "Get first mission assigned", event: "first_mission_assigned" },
  { item: "Run first AI tool", event: V1_ACTIVATION_EVENT },
  { item: "Complete first mission", event: V2_ACTIVATION_EVENT },
  { item: "Return within 7 days", event: "weekly_return" },
  { item: "Upgrade to paid plan", event: "plan_upgraded" },
];

// ── TASK-010 · Non-Core Tool Visibility Rules ─────────────────────────
// Tools hidden during the first-run journey (shown only after onboarding_complete).
// Advanced tools are gated until the user has run at least one core tool.
export const FIRST_RUN_VISIBLE_TOOLS = [
  "idea-validator",
  "kill-my-idea",
  "pitch-generator",
  "offer",
  "gtm-strategy",
  "first-10-customers",
] as const;

export const FIRST_RUN_HIDDEN_TOOLS = [
  "funding-score",
  "website-audit",
  "competitor-analysis",
  "pricing-strategist",
  "landing-page",
  "followup",
  "generate-ops-plan",
] as const;

export function isVisibleOnFirstRun(toolKey: string): boolean {
  return (FIRST_RUN_VISIBLE_TOOLS as readonly string[]).includes(toolKey);
}
