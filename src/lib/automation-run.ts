// Client helper for the run-workflow edge function — the runtime that actually
// executes a Builder block-graph (sends email/SMS, runs AI, writes to the CRM,
// or simulates any step whose provider credentials aren't configured yet).

import { supabase } from "@/integrations/supabase/client";
import type { WorkflowBlock } from "./automation-blocks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RunStepStatus = "ok" | "simulated" | "skipped" | "error";

export interface RunStep {
  block_id: string;
  type: string;
  label: string;
  status: RunStepStatus;
  detail: string;
  /** Nesting level: 0 = trunk, 1+ = inside a taken branch lane. */
  depth?: number;
}

export interface RunResult {
  run_id?: string;
  status: "success" | "failed" | "simulated" | "running";
  mode: "test" | "live";
  simulated: boolean;
  steps_total: number;
  steps_completed: number;
  duration_ms: number;
  trace: RunStep[];
}

export interface RunWorkflowInput {
  blocks: WorkflowBlock[];
  orgId: string;
  workflowName?: string;
  templateId?: string;
  contactId?: string | null;
  mode: "test" | "live";
}

export async function runWorkflow(input: RunWorkflowInput): Promise<RunResult> {
  const { data, error } = await supabase.functions.invoke("run-workflow", {
    body: {
      blocks: input.blocks,
      org_id: input.orgId,
      workflow_name: input.workflowName,
      template_id: input.templateId,
      contact_id: input.contactId ?? null,
      mode: input.mode,
    },
  });
  if (error) throw error;
  return data as RunResult;
}

/**
 * Fire-and-forget nudge to drain this org's pending automation events now, so
 * activated automations run within seconds instead of waiting for the cron.
 * Safe to call optimistically — failures are swallowed.
 */
export function nudgeAutomationDispatch(): void {
  try {
    void supabase.functions.invoke("automation-dispatch", { body: {} });
  } catch {
    /* best-effort */
  }
}

/** Recent execution runs for an org (history surface). */
export function workflowRunsQuery(orgId: string, limit = 25) {
  return {
    queryKey: ["workflow_runs", orgId],
    queryFn: async () => {
      const { data } = await db
        .from("automation_workflow_runs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Array<{
        id: string;
        workflow_name: string;
        status: RunResult["status"];
        mode: "test" | "live";
        steps_total: number;
        steps_completed: number;
        trace: RunStep[];
        duration_ms: number | null;
        created_at: string;
      }>;
    },
  };
}
