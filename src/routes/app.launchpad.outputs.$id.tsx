/**
 * FOUNDER CASEFILE — /app/launchpad/outputs/[id]
 *
 * Routes a saved tool_run to a layout by its output_shape (score_verdict,
 * comparison, report, memo, plan_with_steps, pipeline_snapshot,
 * session_summary). output_shape is authoritative from the DB; if a row
 * predates the column we derive it from tool_key, and if it's still unknown
 * we fall back to MemoLayout AND log a console warning so unwired tools get
 * surfaced instead of silently blobbed.
 *
 * Layout components live in components/launchpad/casefile-layouts.tsx. The
 * interactive runner at /app/launchpad/$tool is untouched.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { useAuth } from "@/lib/auth";
import {
  deriveOutputShape,
  formatLabel,
  readCore,
  type OutputShape,
  type CasefileRun,
} from "@/lib/casefile";
import {
  ScoreVerdictLayout,
  ReportLayout,
  MemoLayout,
  ComparisonLayout,
  PlanWithStepsLayout,
  PipelineSnapshotLayout,
  SessionSummaryLayout,
} from "@/components/launchpad/casefile-layouts";

// Offer/GTM analyses are the ones worth turning into a pipeline deal (Connection 2).
const DEAL_TOOLS = new Set([
  "generate-offer",
  "positioning",
  "generate-gtm-strategy",
  "gtm-strategy-builder",
  "generate-pitch",
]);

const SHAPES: OutputShape[] = [
  "score_verdict",
  "comparison",
  "report",
  "memo",
  "plan_with_steps",
  "pipeline_snapshot",
  "session_summary",
];

export const Route = createFileRoute("/app/launchpad/outputs/$id")({ component: CasefilePage });

function CasefilePage() {
  const { id } = useParams({ from: "/app/launchpad/outputs/$id" });
  const { currentOrgId } = useAuth();
  const runQ = useQuery({
    queryKey: ["tool_run", id],
    queryFn: async () => {
      // casefile_status is newer than the generated Supabase types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data } = await db
        .from("tool_runs")
        .select(
          "id, tool_key, title, status, output, output_shape, model, created_at, casefile_status",
        )
        .eq("id", id)
        .maybeSingle();
      return (data as CasefileRunWithApproval) ?? null;
    },
  });

  const run = runQ.data;

  // Resolve the render shape: DB column → tool_key derivation → fallback.
  const shape = useMemo<OutputShape>(() => {
    if (!run) return "memo";
    const dbShape = run.output_shape as OutputShape | null | undefined;
    if (dbShape && SHAPES.includes(dbShape)) return dbShape;
    const derived = deriveOutputShape(run.tool_key);
    if (derived) return derived;
    // Unwired tool — surface it rather than silently defaulting to memo.
    console.warn(
      `[Casefile] No output_shape for tool "${run.tool_key}" (run ${run.id}); falling back to MemoLayout.`,
    );
    return "memo";
  }, [run]);

  const core = useMemo(() => (run ? readCore(run) : null), [run]);

  if (runQ.isLoading) {
    return (
      <div className="min-h-full bg-[--background] p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-[--surface-2]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[--surface-2]" />
        </div>
      </div>
    );
  }

  if (!run || !core) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[--background] p-6">
        <div className="rounded-2xl border border-[--border] bg-[--surface] p-8 text-center">
          <p className="text-sm font-semibold text-[--foreground]">Casefile not found</p>
          <Link
            to="/app/launchpad/history"
            className="mt-2 inline-block text-xs font-semibold text-[--accent] hover:underline"
          >
            ← Back to Outputs
          </Link>
        </div>
      </div>
    );
  }

  // Founder-analysis shapes can spin up a pipeline deal from the analysis.
  const dealExtra =
    DEAL_TOOLS.has(run.tool_key) && currentOrgId ? (
      <CreateDealCard run={run} recommendation={core.recommendation} orgId={currentOrgId} />
    ) : undefined;

  // The score_verdict casefile is the Founder Casefile of record — approving it
  // builds the personalized course (generate-course edge fn).
  const approveExtra =
    shape === "score_verdict" && currentOrgId ? <ApproveCasefileCard run={run} /> : undefined;

  const extra =
    approveExtra || dealExtra ? (
      <div className="space-y-3">
        {approveExtra}
        {dealExtra}
      </div>
    ) : undefined;

  switch (shape) {
    case "score_verdict":
      return <ScoreVerdictLayout run={run} core={core} extra={extra} />;
    case "comparison":
      return <ComparisonLayout run={run} core={core} extra={extra} />;
    case "report":
      return <ReportLayout run={run} core={core} extra={extra} />;
    case "plan_with_steps":
      return <PlanWithStepsLayout run={run} core={core} extra={extra} />;
    case "pipeline_snapshot":
      return <PipelineSnapshotLayout run={run} core={core} />;
    case "session_summary":
      return <SessionSummaryLayout run={run} core={core} />;
    case "memo":
    default:
      return <MemoLayout run={run} core={core} extra={extra} />;
  }
}

type CasefileRunWithApproval = CasefileRun & { casefile_status?: string | null };

// The one primary action on the Founder Casefile: approve it, and Bylda builds
// the personalized course. Once approved it becomes a link into the course.
function ApproveCasefileCard({ run }: { run: CasefileRunWithApproval }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "building" | "done" | "error">(
    run.casefile_status === "approved" ? "done" : "idle",
  );

  if (state === "done") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-[--primary-border] bg-[color-mix(in_oklab,var(--primary)_6%,var(--surface))] p-4">
        <div>
          <p className="text-sm font-bold text-[--foreground]">Casefile approved ✓</p>
          <p className="text-xs text-[--text-faint]">Your personalized course is ready.</p>
        </div>
        <button
          onClick={() => navigate({ to: "/app/launchpad/course" })}
          className="rounded-xl bg-[--primary] px-4 py-2 text-sm font-bold text-[--primary-foreground]"
        >
          Open my course →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[--primary-border] bg-[color-mix(in_oklab,var(--primary)_7%,var(--surface))] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[--foreground]">Approve this casefile</p>
        <p className="text-xs text-[--text-faint]">
          Bylda turns it into a step-by-step course built around this exact business.
        </p>
        {state === "error" && (
          <p className="mt-1 text-xs font-semibold text-[--destructive]">
            Couldn't build the course. Try again.
          </p>
        )}
      </div>
      <button
        onClick={async () => {
          setState("building");
          try {
            await invokeEdge("generate-course", { casefile_run_id: run.id }, { timeoutMs: 60_000 });
            setState("done");
            navigate({ to: "/app/launchpad/course" });
          } catch {
            setState("error");
          }
        }}
        disabled={state === "building"}
        className="shrink-0 rounded-xl bg-[--primary] px-5 py-2.5 text-sm font-bold text-[--primary-foreground] disabled:opacity-60"
      >
        {state === "building" ? "Building your course…" : "Approve & build my course"}
      </button>
    </div>
  );
}

function CreateDealCard({
  run,
  recommendation,
  orgId,
}: {
  run: CasefileRun;
  recommendation: string;
  orgId: string;
}) {
  const [dealState, setDealState] = useState<"idle" | "creating" | "done">("idle");
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[--border] bg-[--surface] p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-[--foreground]">Turn this into a deal</p>
        <p className="text-xs text-[--text-faint]">
          Start a pipeline opportunity from this analysis.
        </p>
      </div>
      {dealState === "done" ? (
        <Link
          to="/app/bylda/crm"
          className="text-sm font-semibold text-[--success] hover:underline"
        >
          Deal created — view pipeline →
        </Link>
      ) : (
        <button
          onClick={async () => {
            setDealState("creating");
            // create_lead (not a raw insert) so the deal is wired to a deduped
            // contact + company and logged on the CRM timeline.
            try {
              await invokeEdge("crm-action", {
                action: "create_lead",
                org_id: orgId,
                payload: {
                  name: run.title || `${formatLabel(run.tool_key)} lead`,
                  stage: "New",
                  source: "casefile",
                  notes:
                    `Created from ${formatLabel(run.tool_key)} (case ${run.id.slice(0, 8)}). ${recommendation}`.slice(
                      0,
                      500,
                    ),
                },
              });
              setDealState("done");
            } catch {
              setDealState("idle");
            }
          }}
          disabled={dealState === "creating"}
          className="rounded-xl bg-[--accent] px-4 py-2 text-sm font-semibold text-white hover:bg-[--primary-hover] disabled:opacity-50"
        >
          {dealState === "creating" ? "Creating…" : "Create Deal"}
        </button>
      )}
    </div>
  );
}
