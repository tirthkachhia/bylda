/**
 * FounderHome — the context rail that leads /app/launchpad.
 *
 * Stage and active-mission status already live in the redesigned Home
 * (/app/mission-control), so this only surfaces what isn't shown there:
 * Bylda's stage-and-industry guidance, a Pipeline Snapshot, and Recent Memory.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  organizationQuery,
  businessContextQuery,
  leadsQuery,
  memoryArtifactsQuery,
} from "@/lib/queries";

const STAGES = ["Clarify", "Validate", "Build", "Launch", "Operate", "Scale"];

const GUIDANCE_BY_STAGE: Record<string, { prompt: string; cta: string }> = {
  Clarify: {
    prompt: "Let's pin down exactly who you're building for.",
    cta: "Clarify my customer",
  },
  Validate: { prompt: "Stress-test your idea before you build more.", cta: "Validate my idea" },
  Build: { prompt: "Turn your plan into the smallest shippable slice.", cta: "Plan my MVP" },
  Launch: { prompt: "Line up the assets and channels to go live.", cta: "Build my GTM path" },
  Operate: { prompt: "Tighten your follow-up so no lead goes cold.", cta: "Draft follow-ups" },
  Scale: {
    prompt: "Find the channel that compounds and double down.",
    cta: "Find my growth lever",
  },
};

function jsonText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return Object.values(v as Record<string, unknown>)
      .filter((x) => typeof x === "string" && x)
      .join(" · ");
  } catch {
    return "";
  }
}

export function FounderHome({ orgId, userId: _userId }: { orgId: string; userId: string }) {
  const org = useQuery(organizationQuery(orgId));
  const ctx = useQuery(businessContextQuery(orgId));
  const leads = useQuery(leadsQuery(orgId));
  const memory = useQuery(memoryArtifactsQuery(orgId));

  const tasksDue = useQuery({
    queryKey: ["tasks-due-today", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .neq("status", "completed")
        .lte("due_date", end.toISOString());
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const stage = (org.data?.stage as string) || jsonText(ctx.data?.stage) || "Validate";
  const stageIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.toLowerCase() === String(stage).toLowerCase()),
  );
  const industry =
    (ctx.data?.identity as Record<string, unknown> | undefined)?.industry &&
    typeof (ctx.data?.identity as Record<string, unknown>).industry === "string"
      ? ((ctx.data?.identity as Record<string, unknown>).industry as string)
      : "";

  const pipeline = useMemo(() => {
    const rows = leads.data ?? [];
    const active = rows.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
    const value = active.reduce((s, l) => s + Number((l as { value?: number }).value ?? 0), 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const won = rows.filter(
      (l) =>
        l.stage === "Won" && new Date((l as { updated_at?: string }).updated_at ?? 0) >= monthStart,
    ).length;
    return { active: active.length, value, won };
  }, [leads.data]);

  const guidance = GUIDANCE_BY_STAGE[STAGES[stageIndex]] ?? GUIDANCE_BY_STAGE.Validate;
  const guidancePrompt = industry
    ? `${guidance.prompt} (for your ${industry} business)`
    : guidance.prompt;

  return (
    <div className="mb-8 grid grid-cols-1 gap-3.5 md:grid-cols-3">
      {/* Bylda Guidance — stage- and industry-aware */}
      <div
        className="rounded-2xl p-5 text-[--primary-foreground] shadow-sm"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Bylda Guidance</span>
        </div>
        <p className="text-sm leading-relaxed opacity-90">{guidancePrompt}</p>
        <Link
          to="/app/launchpad/bylda"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
        >
          {guidance.cta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Pipeline Snapshot */}
      <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Pipeline
          </span>
          <Link
            to="/app/bylda/crm"
            className="text-xs font-semibold text-[--accent] hover:underline"
          >
            View Pipeline →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Active Deals" value={pipeline.active} />
          <Stat
            label="Pipeline Value"
            value={pipeline.value ? `$${pipeline.value.toLocaleString()}` : "$0"}
          />
          <Stat label="Won This Month" value={pipeline.won} />
          <Stat label="Tasks Due" value={tasksDue.data ?? 0} icon={<Clock className="h-3 w-3" />} />
        </div>
      </div>

      {/* Recent Memory */}
      <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[--text-faint]">
            Recent Memory
          </span>
          <Link
            to="/app/launchpad/history"
            className="text-xs font-semibold text-[--accent] hover:underline"
          >
            View all →
          </Link>
        </div>
        {memory.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[--surface-2]" />
            ))}
          </div>
        ) : (memory.data ?? []).length === 0 ? (
          <p className="py-3 text-xs text-[--text-faint]">Outputs Bylda saves will appear here.</p>
        ) : (
          <div className="space-y-2">
            {(memory.data ?? []).slice(0, 3).map((m) => (
              <div
                key={(m as { id: string }).id}
                className="flex items-center gap-2 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2"
              >
                <span className="truncate text-sm text-[--foreground]">
                  {(m as { title?: string }).title || "Saved insight"}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-[--primary-soft] px-2 py-0.5 text-[10px] font-semibold text-[--accent]">
                  {(m as { source_label?: string }).source_label || "memory"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[--text-faint]">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[--foreground]">{value}</p>
    </div>
  );
}
