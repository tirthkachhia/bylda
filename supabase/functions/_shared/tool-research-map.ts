// Tool → research capability map (static, team-editable — same principle as
// src/lib/handoffs.ts: a flat declared map, never a classifier).
//
// Only tools that genuinely benefit from live market data are listed.
// Everything NOT in this map runs exactly as before, with no Perplexity call.
//
// EDITING GUIDE:
//   • Keys are the canonical TOOLS registry keys in run-tool/index.ts.
//     Frontend aliases (TOOL_ALIASES) are resolved via ALIAS_KEYS below —
//     if you add a tool that has aliases, add them there too.
//   • buildQuery receives the tool's raw `input` record (the same object
//     buildUserPrompt reads) — use the same field fallbacks that tool uses.
//   • tier: "sonar-pro" for deep competitive/market work, "sonar" for
//     lighter demand/pricing signals.

import type { PerplexityTier } from "./perplexity.ts";

type ToolInput = Record<string, unknown>;

export interface ResearchConfig {
  tier: PerplexityTier;
  buildQuery: (input: ToolInput) => string;
  systemHint?: string;
}

const s = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");

export const RESEARCH_TOOLS: Record<string, ResearchConfig> = {
  // ── Proving tools (wired end-to-end first) ────────────────────────────────
  "idea-validator": {
    tier: "sonar-pro",
    buildQuery: (i) =>
      `Current 2026 market for this business idea: ${s(i.idea_description) || s(i.idea)}. ` +
      `Real demand signals, market size with sources, top named competitors and their pricing, ` +
      `saturation level, and current trends. Target market: ${
        s(i.target_market) || s(i.targetMarket) || "not specified"
      }. Problem being solved: ${s(i.problem_being_solved) || s(i.problem) || "not specified"}.`,
    systemHint: "Prioritize 2026 data. Name real companies and cite real sources.",
  },
  "competitor-scanner": {
    tier: "sonar-pro",
    buildQuery: (i) =>
      `Top current competitors for: ${s(i.business_description) || s(i.business)}. ` +
      `Target market: ${s(i.target_market) || s(i.targetMarket) || "not specified"}. ` +
      `Geography: ${s(i.geography) || "global"}. For each competitor: positioning, current pricing, ` +
      `strengths, weaknesses, and notable moves in 2025-2026.`,
  },
  "niche-scorer": {
    tier: "sonar",
    buildQuery: (i) =>
      `Current demand, competition, and profitability signals for this niche: ${
        s(i.niche_description) || s(i.niche) || s(i.context)
      }. Include search/market demand trends, how crowded the niche is, and typical monetization in 2026.`,
  },

  // ── Mapped for enrichment (same pipeline, not part of the proving run) ────
  "pricing-calculator": {
    tier: "sonar",
    buildQuery: (i) =>
      `Current market pricing for: ${s(i.product) || s(i.offer) || s(i.context)}. ` +
      `Real named competitors' price points and pricing models in 2026, and what the market bears.`,
  },
  "gtm-strategy-builder": {
    tier: "sonar",
    buildQuery: (i) =>
      `Current customer acquisition channels and costs for: ${
        s(i.product) || s(i.business_description) || s(i.context)
      }. Which channels are working in 2026 for this category, with real benchmarks (CAC, conversion rates) where available.`,
  },
  "funding-readiness-score": {
    tier: "sonar",
    buildQuery: (i) =>
      `Current 2026 early-stage funding environment for: ${s(i.idea) || s(i.business) || s(i.context)}. ` +
      `Typical pre-seed/seed valuations and round sizes in this category, active investors, and what they fund now.`,
  },
};

// Frontend/mission aliases that must resolve to the same research config
// (mirrors TOOL_ALIASES in run-tool/index.ts — the dispatcher passes the raw
// requested key through to the pipeline).
const ALIAS_KEYS: Record<string, string> = {
  "validate-idea": "idea-validator",
  "competitor-analysis": "competitor-scanner",
  "pricing-strategy": "pricing-calculator",
  "generate-gtm-strategy": "gtm-strategy-builder",
  "gtm-strategy": "gtm-strategy-builder",
  "funding-score": "funding-readiness-score",
};

export function getResearchConfig(toolKey: string): ResearchConfig | null {
  return RESEARCH_TOOLS[toolKey] ?? RESEARCH_TOOLS[ALIAS_KEYS[toolKey] ?? ""] ?? null;
}
