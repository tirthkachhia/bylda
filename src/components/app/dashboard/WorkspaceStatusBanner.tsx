/**
 * WorkspaceStatusBanner — two jobs, rendered above everything else on Home:
 *
 * 1. REPAIR: if workspace provisioning never finished (failed/pending), the
 *    user used to land on a silently empty dashboard. Now they get a one-click
 *    "Finish setup" that re-runs the idempotent completion saga from their
 *    saved onboarding answers.
 * 2. OPERATE MODE: operators get a cockpit strip (Pipeline / Automations /
 *    Reports) instead of founder-flavored framing.
 */

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Wrench, Workflow, Zap, BarChart3, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { workspaceStatusQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/invokeEdge";
import { toast } from "sonner";

export function WorkspaceStatusBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [repairing, setRepairing] = useState(false);

  const q = useQuery({ ...workspaceStatusQuery(user?.id ?? ""), enabled: !!user?.id });
  const ws = q.data;

  const repair = async () => {
    if (repairing) return;
    setRepairing(true);
    try {
      const { data: session } = await supabase
        .from("onboarding_sessions")
        .select("mode, answers")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!session?.answers || Object.keys(session.answers as object).length === 0) {
        // No saved answers to replay — send them through onboarding again.
        navigate({ to: "/onboarding" });
        return;
      }
      await invokeEdge(
        "complete-onboarding",
        { mode: session.mode ?? "create", answers: session.answers },
        { timeoutMs: 90_000, retries: 1 },
      );
      toast.success("Workspace setup finished");
      qc.invalidateQueries({ queryKey: ["workspace-status", user!.id] });
      qc.invalidateQueries({ queryKey: ["current-mission", user!.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Repair failed — please try again.");
    } finally {
      setRepairing(false);
    }
  };

  if (!ws) return null;

  // ── Repair banner ───────────────────────────────────────────────────────────
  if (ws.provisioning_status === "failed" || ws.provisioning_status === "pending") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: "color-mix(in oklab, var(--warning) 35%, transparent)",
          background: "color-mix(in oklab, var(--warning) 7%, transparent)",
        }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} />
          <div>
            <div className="text-[13.5px] font-semibold">Your workspace setup didn't finish</div>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Your missions and AI briefing are missing because provisioning was interrupted. One
              click fixes it — your onboarding answers are saved.
            </p>
          </div>
        </div>
        <button
          onClick={repair}
          disabled={repairing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-60"
          style={{
            background: "var(--warning)",
            color: "#1a1a1a",
          }}
        >
          {repairing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Repairing…
            </>
          ) : (
            <>
              <Wrench className="h-3.5 w-3.5" /> Finish setup
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Operator cockpit strip ──────────────────────────────────────────────────
  if (ws.mode === "operate") {
    const links = [
      { to: "/app/bylda/crm", label: "Pipeline", icon: Workflow },
      { to: "/app/automations", label: "Automations", icon: Zap },
      { to: "/app/bylda/reports", label: "Reports", icon: BarChart3 },
    ];
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
        style={{
          borderColor: "color-mix(in oklab, var(--domain-customers) 30%, transparent)",
          background: "color-mix(in oklab, var(--domain-customers) 5%, transparent)",
        }}
      >
        <div
          className="flex items-center gap-2 text-[12.5px] font-semibold"
          style={{ color: "var(--domain-customers)" }}
        >
          <Zap className="h-3.5 w-3.5" /> Operator mode
          <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>
            — your cockpit, one click away
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition hover:opacity-80"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <l.icon className="h-3.5 w-3.5" style={{ color: "var(--domain-customers)" }} />
              {l.label}
              <ArrowRight className="h-3 w-3 opacity-50" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
