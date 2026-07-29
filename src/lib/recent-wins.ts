// Recent Wins — a chronological feed merged from real, already-tracked
// events (succeeded tool runs, won deals, automations turned on). No new
// event-log table: each source is a query already used elsewhere in the
// app, just sorted and capped here. XP amounts reuse the same XP_BY_TOOL
// table that drives the Level/XP system, so the numbers always agree.

import { XP_BY_TOOL, DEFAULT_XP } from "@/hooks/use-founder-progress";
import type { LeadRow } from "@/hooks/use-business-graph";
import { toolNameForSlug } from "@/lib/business-roadmap";

export interface Win {
  id: string;
  text: string;
  detail: string | null;
  timestamp: string;
}

export interface ToolRunRow {
  id: string;
  tool_key?: string | null;
  status: string;
  created_at: string;
}

export interface AutomationRow {
  id: string;
  automation_slug: string;
  is_active: boolean;
  created_at: string;
}

function isWon(stage: string | null): boolean {
  const s = (stage ?? "").toLowerCase();
  return s.includes("won") || s.includes("closed");
}

export function deriveRecentWins(
  runs: ToolRunRow[],
  leads: LeadRow[],
  automations: AutomationRow[],
  limit = 6,
): Win[] {
  const runWins: Win[] = runs
    .filter((r) => r.status === "succeeded")
    .map((r) => {
      const key = r.tool_key ?? "";
      const xp = XP_BY_TOOL[key] ?? DEFAULT_XP;
      return {
        id: `run-${r.id}`,
        text: `Completed ${toolNameForSlug(key)}`,
        detail: `+${xp} XP`,
        timestamp: r.created_at,
      };
    });

  const dealWins: Win[] = leads
    .filter((l) => isWon(l.stage))
    .map((l) => ({
      id: `lead-${l.id}`,
      text: `Closed deal with ${l.name || "a lead"}`,
      detail: l.value ? `+$${l.value.toLocaleString()}` : null,
      timestamp: l.updated_at ?? l.created_at ?? new Date(0).toISOString(),
    }));

  const automationWins: Win[] = automations
    .filter((a) => a.is_active)
    .map((a) => ({
      id: `automation-${a.id}`,
      text: `Turned on ${toolNameForSlug(a.automation_slug)}`,
      detail: null,
      timestamp: a.created_at,
    }));

  return [...runWins, ...dealWins, ...automationWins]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
