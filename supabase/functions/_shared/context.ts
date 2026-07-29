// assembleContext — the single context-injection path for every AI call.
//
// Reads the Business Context Graph (business_context), falls back to legacy
// onboarding_responses, pulls RELATED prior tool outputs from memory, and
// (when chaining) the specific run the user is continuing from. Returns a
// budgeted prompt block plus the list of facts used, so outputs can carry a
// verifiable "context receipt".

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export interface AssembledContext {
  /** Prompt-ready block. Empty string when nothing is known. */
  block: string;
  /** Human-readable facts injected — the context receipt fallback. */
  used: string[];
}

// Which prior tool outputs are relevant to which tool. Keys are backend tool
// keys (run-tool TOOLS map); values are memory source_labels to pull.
const RELATED_TOOLS: Record<string, string[]> = {
  "kill-my-idea": ["idea-validator", "validate-idea"],
  "competitor-scanner": ["idea-validator", "validate-idea"],
  "gtm-strategy-builder": ["idea-validator", "positioning-engine", "competitor-scanner", "offer"],
  "gtm-strategy": ["idea-validator", "positioning-engine", "competitor-scanner", "offer"],
  "first-10-customers-finder": ["gtm-strategy-builder", "gtm-strategy", "persona-builder", "offer"],
  "first-10-customers": ["gtm-strategy-builder", "gtm-strategy", "persona-builder", "offer"],
  "pitch-generator": [
    "idea-validator",
    "validate-idea",
    "gtm-strategy-builder",
    "business-plan-generator",
  ],
  "landing-page-creator": [
    "positioning-engine",
    "offer",
    "persona-builder",
    "gtm-strategy-builder",
  ],
  "email-sequence": ["persona-builder", "first-10-customers-finder", "offer"],
  followup: ["persona-builder", "first-10-customers-finder", "offer"],
  "pricing-calculator": ["competitor-scanner", "offer", "positioning-engine"],
  "business-plan-generator": ["idea-validator", "gtm-strategy-builder", "pricing-calculator"],
  "business-plan": ["idea-validator", "gtm-strategy-builder", "pricing-calculator"],
  "investor-email-writer": [
    "funding-readiness-score",
    "pitch-generator",
    "business-plan-generator",
  ],
  "funding-readiness-score": ["business-plan-generator", "idea-validator"],
  "kpi-dashboard": ["generate-ops-plan", "gtm-strategy-builder"],
  "generate-ops-plan": ["kpi-dashboard", "gtm-strategy-builder"],
  "ad-copy": ["persona-builder", "positioning-engine", "landing-page-creator"],
  "persona-builder": ["idea-validator", "gtm-strategy-builder"],
  offer: ["idea-validator", "positioning-engine", "persona-builder"],
};

const str = (b: Record<string, unknown> | null | undefined, k: string): string => {
  const v = b?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : "";
};
const list = (b: Record<string, unknown> | null | undefined, k: string): string[] => {
  const v = b?.[k];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
};
const block = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

export async function assembleContext(
  supabase: SupabaseClient,
  organizationId: string,
  opts: { toolKey?: string; fromRunId?: string; budgetChars?: number } = {},
): Promise<AssembledContext> {
  const budget = opts.budgetChars ?? 6000;
  const lines: string[] = [];
  const used: string[] = [];

  // ── 1. Business Context Graph (canonical) ─────────────────────────────────
  const { data: ctx } = await supabase
    .from("business_context")
    .select("identity, customer, stage, model, goals, constraints, motion, verdicts")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (ctx) {
    const identity = block(ctx.identity);
    const customer = block(ctx.customer);
    const stage = block(ctx.stage);
    const model = block(ctx.model);
    const goals = block(ctx.goals);
    const constraints = block(ctx.constraints);
    const motion = block(ctx.motion);

    const name = str(identity, "name");
    const desc = str(identity, "description");
    if (name || desc) {
      lines.push(`Business: ${[name, desc].filter(Boolean).join(" — ")}`);
      used.push(desc ? `business: ${desc.slice(0, 60)}` : `business: ${name}`);
    }
    const industry = [str(identity, "industry"), str(identity, "niche")]
      .filter(Boolean)
      .join(" / ");
    if (industry) {
      lines.push(`Industry/niche: ${industry}`);
      used.push(`industry: ${industry}`);
    }
    const target = str(customer, "target");
    const targetDesc = str(customer, "description");
    if (target || targetDesc) {
      lines.push(`Target customer: ${[target, targetDesc].filter(Boolean).join(" — ")}`);
      used.push(`target: ${target || targetDesc}`);
    }
    const stageLine = [
      str(stage, "stage") && `${str(stage, "stage")} stage`,
      str(stage, "lane") && `${str(stage, "lane")} lane`,
      str(stage, "revenue_band") && `revenue ${str(stage, "revenue_band")}`,
      str(stage, "team_size") && `team: ${str(stage, "team_size")}`,
    ]
      .filter(Boolean)
      .join(" · ");
    if (stageLine) {
      lines.push(`Where they are: ${stageLine}`);
      used.push(stageLine);
    }
    const monetization = str(model, "monetization");
    if (monetization) {
      lines.push(`Revenue model: ${monetization}`);
      used.push(`revenue model: ${monetization}`);
    }
    const goal = str(goals, "goal_90d") || str(goals, "scale_goal");
    if (goal) {
      lines.push(`Primary goal: ${goal}`);
      used.push(`goal: ${goal}`);
    }
    const cons = [
      str(constraints, "time"),
      str(constraints, "budget") && `budget ${str(constraints, "budget")}`,
      str(constraints, "experience"),
    ]
      .filter(Boolean)
      .join(" · ");
    if (cons) {
      lines.push(`Constraints: ${cons}`);
      used.push(`constraints: ${cons}`);
    }
    const bottlenecks = list(motion, "bottlenecks");
    if (bottlenecks.length) {
      lines.push(`Stated bottlenecks: ${bottlenecks.join(", ")}`);
      used.push(`bottlenecks: ${bottlenecks.join(", ")}`);
    }
    const channels = list(motion, "channels");
    if (channels.length) lines.push(`Acquisition channels today: ${channels.join(", ")}`);
  } else {
    // ── Legacy fallback ───────────────────────────────────────────────────
    const { data: ob } = await supabase
      .from("onboarding_responses")
      .select("offer, niche, stage, goal, current_revenue, target_customer, biggest_blocker")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (ob) {
      if (ob.offer) {
        lines.push(`Business: ${ob.offer}`);
        used.push(`business: ${String(ob.offer).slice(0, 60)}`);
      }
      if (ob.target_customer) {
        lines.push(`Target customer: ${ob.target_customer}`);
        used.push(`target: ${ob.target_customer}`);
      }
      if (ob.stage) {
        lines.push(`Stage: ${ob.stage} · revenue ${ob.current_revenue ?? "unknown"}`);
        used.push(`${ob.stage} stage`);
      }
      if (ob.goal) {
        lines.push(`Primary goal: ${ob.goal}`);
        used.push(`goal: ${ob.goal}`);
      }
      if (ob.biggest_blocker) lines.push(`Biggest blocker: ${ob.biggest_blocker}`);
    }
  }

  // ── 2. The specific run being continued (chaining) ────────────────────────
  let priorBudget = Math.max(0, budget - lines.join("\n").length - 400);
  if (opts.fromRunId && priorBudget > 200) {
    const { data: fromRun } = await supabase
      .from("tool_runs")
      .select("tool_key, output")
      .eq("id", opts.fromRunId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (fromRun?.output) {
      const snippet = JSON.stringify(fromRun.output).slice(0, Math.min(2500, priorBudget));
      lines.push(
        `\nThe user is continuing directly from their "${fromRun.tool_key}" output. Build on it — do not contradict it without explicitly saying so:\n${snippet}`,
      );
      used.push(`prior ${fromRun.tool_key} output`);
      priorBudget -= snippet.length + 120;
    }
  }

  // ── 3. Related prior outputs from memory ─────────────────────────────────
  const related = opts.toolKey ? (RELATED_TOOLS[opts.toolKey] ?? []) : [];
  if (related.length > 0 && priorBudget > 300) {
    const { data: artifacts } = await supabase
      .from("memory_artifacts")
      .select("source_label, title, content, content_preview")
      .eq("org_id", organizationId)
      .in("source_label", related)
      .order("created_at", { ascending: false })
      .limit(3);

    if (artifacts && artifacts.length > 0) {
      const seen = new Set<string>();
      const parts: string[] = [];
      for (const a of artifacts) {
        const label = a.source_label as string;
        if (seen.has(label)) continue; // newest per tool only
        seen.add(label);
        const body =
          (typeof a.content === "string" && a.content) ||
          (typeof a.content_preview === "string" && a.content_preview) ||
          "";
        if (!body) continue;
        const slice = body.slice(0, Math.min(1200, priorBudget));
        if (slice.length < 50) continue;
        parts.push(`[${label}] ${slice}`);
        used.push(`prior ${label} output`);
        priorBudget -= slice.length + 40;
        if (priorBudget < 200) break;
      }
      if (parts.length > 0) {
        lines.push(
          `\nPrior Bylda outputs for this business (reference them; flag contradictions explicitly):\n${parts.join("\n\n")}`,
        );
      }
    }
  }

  if (lines.length === 0) return { block: "", used: [] };

  const blockText =
    `## FOUNDER CONTEXT (verified facts about THIS business — ground every claim in these)\n` +
    lines.join("\n");
  return { block: blockText.slice(0, budget), used };
}
