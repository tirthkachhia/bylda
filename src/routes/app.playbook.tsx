/**
 * PLAYBOOK — /app/playbook
 *
 * Read-only history of completed mission steps: the past-tense record of
 * what the founder has already shipped, grouped by mission. This page is
 * not an active tracker — the live "do this now" lives on the mission
 * spine (mission-control / dashboard), and this page never competes with
 * it. Zero write paths.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Check, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/playbook")({ component: PlaybookHistoryPage });

interface HistoryStep {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sort_order: number;
  completed_at: string | null;
}

interface HistoryMission {
  id: string;
  title: string;
  status: string;
  sort_order: number;
  steps: HistoryStep[];
}

/** All missions for the user's workspace with their closed-out steps. */
function missionHistoryQuery(userId: string) {
  return {
    queryKey: ["mission-history", userId],
    queryFn: async (): Promise<HistoryMission[]> => {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!ws) return [];

      const { data: missions, error: mErr } = await supabase
        .from("missions")
        .select("id, title, status, sort_order")
        .eq("workspace_id", ws.id)
        .order("sort_order");
      if (mErr) throw mErr;
      if (!missions || missions.length === 0) return [];

      const { data: steps, error: sErr } = await supabase
        .from("mission_steps")
        .select("id, mission_id, title, description, status, sort_order, completed_at")
        .in(
          "mission_id",
          missions.map((m) => m.id),
        )
        .order("sort_order");
      if (sErr) throw sErr;

      return missions.map((m) => ({
        id: m.id as string,
        title: (m.title as string) ?? "",
        status: (m.status as string) ?? "",
        sort_order: (m.sort_order as number) ?? 0,
        steps: ((steps ?? []) as Array<HistoryStep & { mission_id: string }>)
          .filter((s) => s.mission_id === m.id)
          .filter((s) => s.status === "completed" || s.status === "skipped"),
      }));
    },
    staleTime: 60_000,
  };
}

function PlaybookHistoryPage() {
  const { user } = useAuth();
  const historyQ = useQuery({ ...missionHistoryQuery(user?.id ?? ""), enabled: !!user?.id });

  if (historyQ.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  const missions = (historyQ.data ?? []).filter((m) => m.steps.length > 0);
  const totalDone = missions.reduce((n, m) => n + m.steps.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-7 p-4 sm:p-6">
      {/* ── Header ── */}
      <div>
        <div
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "var(--primary)" }}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Playbook
        </div>
        <h1
          className="mt-1.5 font-display text-[26px] font-bold leading-tight tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          What you&rsquo;ve shipped
        </h1>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--muted-foreground)" }}>
          {totalDone > 0
            ? `${totalDone} step${totalDone === 1 ? "" : "s"} completed. This is the record — your next move lives on Mission Control.`
            : "Your completed steps will appear here as you work through your missions."}
        </p>
      </div>

      {/* ── Empty state ── */}
      {missions.length === 0 && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
            Nothing completed yet
          </div>
          <p
            className="mx-auto mt-1.5 max-w-md text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Finish your first mission step and it will show up here as a permanent record.
          </p>
          <Link
            to="/app/mission-control"
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            Go to your current step <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* ── Completed steps, grouped by mission ── */}
      {missions.map((mission) => (
        <div key={mission.id}>
          <div className="mb-3 flex items-baseline gap-2.5">
            <span
              className="font-display text-[15px] font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {mission.title}
            </span>
            <span className="text-[11.5px] font-medium" style={{ color: "var(--text-faint)" }}>
              {mission.status === "completed" ? "mission complete" : "in progress"}
            </span>
          </div>
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {mission.steps.map((step, i) => (
              <div
                key={step.id}
                className="flex items-center gap-3.5 px-5 py-3.5"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={
                    step.status === "completed"
                      ? { background: "var(--success)", color: "var(--success-foreground, white)" }
                      : { background: "var(--surface-2)", color: "var(--text-faint)" }
                  }
                >
                  {step.status === "completed" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <SkipForward className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[13.5px] font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="truncate text-[12px]" style={{ color: "var(--text-faint)" }}>
                      {step.description}
                    </div>
                  )}
                </div>
                <span
                  className="shrink-0 text-[11.5px] font-semibold"
                  style={{
                    color: step.status === "completed" ? "var(--success)" : "var(--text-faint)",
                  }}
                >
                  {step.status === "completed"
                    ? `Done${step.completed_at ? ` · ${formatDate(step.completed_at)}` : ""}`
                    : "Skipped"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
