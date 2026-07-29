import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toolRunsQuery } from "@/lib/queries";
import { launchpadCatalog } from "@/lib/mock";
import { ArrowLeft, ArrowRight, History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/launchpad/history")({ component: HistoryPage });

const TOOL_BY_KEY = Object.fromEntries(launchpadCatalog.map((t) => [t.toolKey, t]));

function HistoryPage() {
  const { currentOrgId } = useAuth();
  const q = useQuery({ ...toolRunsQuery(currentOrgId ?? "", 100), enabled: !!currentOrgId });
  const runs = q.data ?? [];

  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"all" | "succeeded" | "running" | "failed">("all");

  const filtered = useMemo(
    () =>
      runs.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (filter) {
          const f = filter.toLowerCase();
          const tool = TOOL_BY_KEY[r.tool_key];
          if (!(tool?.name.toLowerCase().includes(f) || r.tool_key.toLowerCase().includes(f))) {
            return false;
          }
        }
        return true;
      }),
    [runs, filter, status],
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Link
            to="/app/launchpad"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
          >
            <ArrowLeft className="h-3 w-3" /> Bylda
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">Run history</span>
        </div>
        <h1 className="mt-3 font-display text-[1.75rem] font-semibold tracking-tight">
          Run history
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Every output you've generated. Open any run to inspect or copy its result.
        </p>
      </div>

      {runs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Filter by tool name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="sm:max-w-sm bg-surface-2"
          />
          <div className="flex gap-1 rounded-md border border-border bg-surface-2 p-0.5">
            {(["all", "succeeded", "running", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11.5px] font-medium capitalize transition",
                  status === s
                    ? "bg-surface text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={runs.length === 0 ? "No runs yet" : "No matching runs"}
          description={
            runs.length === 0
              ? "Run a Bylda tool to see your history populate here."
              : "Try a different filter or status."
          }
          action={
            runs.length === 0 && (
              <Link
                to="/app/launchpad"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
              >
                Open Bylda <ArrowRight className="h-3 w-3" />
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-2/40 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Tool</th>
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const tool = TOOL_BY_KEY[r.tool_key];
                  const input = (r.input ?? {}) as {
                    business?: string;
                    title?: string;
                    context?: string;
                  };
                  const ctx = input.business || input.title || input.context || "Untitled run";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border-subtle/60 last:border-b-0 hover:bg-surface-2/40 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium">{tool?.name ?? r.tool_key}</div>
                        <div className="text-[11px] text-muted-foreground">{r.tool_key}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-[13px] text-foreground/85">{ctx}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground tabular-nums">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          {r.status === "succeeded" && (
                            <Link
                              to="/app/launchpad/outputs/$id"
                              params={{ id: r.id }}
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:opacity-80"
                            >
                              View
                            </Link>
                          )}
                          {tool ? (
                            <Link
                              to="/app/launchpad/$tool"
                              params={{ tool: tool.key }}
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                            >
                              Re-run <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : r.status !== "succeeded" ? (
                            <span className="text-[11.5px] text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" /> Succeeded
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Running
    </span>
  );
}
