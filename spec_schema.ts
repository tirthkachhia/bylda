// Agent-Executable Spec schema — Phase 4

export type ByldaSpec = {
  id: string;
  org_id: string;
  spec_type: "campaign" | "product" | "automation" | "growth" | "ops";
  title: string;
  objective: string;
  steps: Array<{
    order: number;
    action: string;
    owner: string;
    tool: string;
    duration_hours: number;
  }>;
  triggers: Array<{
    event: string;
    condition: string;
    action: string;
  }>;
  success_metrics: Array<{
    metric: string;
    target_value: number;
    unit: string;
    check_date: string;
  }>;
  executable: boolean;
  status: "draft" | "approved" | "executing" | "complete";
  created_at: string;
};

export function validateSpec(spec: unknown): spec is ByldaSpec {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as Record<string, unknown>;

  if (typeof s.id !== "string" || !s.id) return false;
  if (typeof s.org_id !== "string" || !s.org_id) return false;

  const validSpecTypes = ["campaign", "product", "automation", "growth", "ops"];
  if (!validSpecTypes.includes(s.spec_type as string)) return false;

  if (typeof s.title !== "string" || !s.title) return false;
  if (typeof s.objective !== "string" || !s.objective) return false;

  if (!Array.isArray(s.steps)) return false;
  for (const step of s.steps) {
    if (!step || typeof step !== "object") return false;
    const st = step as Record<string, unknown>;
    if (typeof st.order !== "number") return false;
    if (typeof st.action !== "string") return false;
    if (typeof st.owner !== "string") return false;
    if (typeof st.tool !== "string") return false;
    if (typeof st.duration_hours !== "number") return false;
  }

  if (!Array.isArray(s.triggers)) return false;
  for (const trigger of s.triggers) {
    if (!trigger || typeof trigger !== "object") return false;
    const tr = trigger as Record<string, unknown>;
    if (typeof tr.event !== "string") return false;
    if (typeof tr.condition !== "string") return false;
    if (typeof tr.action !== "string") return false;
  }

  if (!Array.isArray(s.success_metrics)) return false;
  for (const m of s.success_metrics) {
    if (!m || typeof m !== "object") return false;
    const sm = m as Record<string, unknown>;
    if (typeof sm.metric !== "string") return false;
    if (typeof sm.target_value !== "number") return false;
    if (typeof sm.unit !== "string") return false;
    if (typeof sm.check_date !== "string") return false;
  }

  if (typeof s.executable !== "boolean") return false;

  const validStatuses = ["draft", "approved", "executing", "complete"];
  if (!validStatuses.includes(s.status as string)) return false;

  if (typeof s.created_at !== "string" || !s.created_at) return false;

  return true;
}
