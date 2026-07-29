import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/app/WorkspaceHeader";
import { useAuth } from "@/lib/auth";
import { generatedAssetsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderOpen, Rocket, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { blockIfGuest } from "@/lib/guest";

export const Route = createFileRoute("/app/assets")({ component: AssetsPage });

const KIND_TONE: Record<string, string> = {
  "generate-pitch": "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "generate-offer": "border-primary/30 bg-primary/10 text-primary",
  "generate-followup-sequence":
    "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "analyze-website": "border-warning/30 bg-warning/10 text-warning",
  "generate-gtm-strategy": "border-launchpad/30 bg-launchpad/10 text-launchpad",
  "validate-idea": "border-success/30 bg-success/10 text-success",
  "generate-ops-plan": "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  "competitor-scanner": "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "generate-pitch", label: "Pitch decks" },
  { key: "generate-offer", label: "Offers" },
  { key: "generate-followup-sequence", label: "Email sequences" },
  { key: "analyze-website", label: "Audits" },
  { key: "competitor-scanner", label: "Competitor snapshots" },
];

interface CompetitorSnapshotMeta {
  tier1?: unknown[];
  tier2?: unknown[];
  gaps?: unknown[];
  winning_angle?: string;
}

function AssetsPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const assetsQ = useQuery({
    ...generatedAssetsQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });
  const all = assetsQ.data ?? [];
  const assets = useMemo(
    () => (filter === "all" ? all : all.filter((a) => a.kind === filter)),
    [all, filter],
  );

  const downloadJSON = (a: { title: string; metadata: unknown }) => {
    const blob = new Blob([JSON.stringify(a.metadata, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.title.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteAsset = async (id: string) => {
    if (blockIfGuest("Sign up to manage your real library.")) return;
    const { error } = await supabase.from("generated_assets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Asset removed");
      qc.invalidateQueries({ queryKey: ["generated_assets", currentOrgId] });
    }
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        variant="assets"
        icon={FolderOpen}
        eyebrow="Assets · creative studio"
        title="Asset library"
        description="Every output your AI tools have generated, in one place."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">No assets yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a tool to generate your first asset.
          </p>
          <Link to="/app/launchpad">
            <Button className="mt-4 gap-2">
              <Rocket className="h-4 w-4" /> Open Bylda
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div
              key={a.id}
              className="tactical-card overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                    KIND_TONE[a.kind] ?? "border-border text-muted-foreground",
                  )}
                >
                  {a.kind.replace(/-/g, " ")}
                </span>
              </div>
              <div className="mt-4 truncate font-display text-[15px] font-semibold">{a.title}</div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString()}
              </div>
              {a.kind === "competitor-scanner" &&
                (() => {
                  const meta = (a.metadata ?? {}) as CompetitorSnapshotMeta;
                  const tier1Count = Array.isArray(meta.tier1) ? meta.tier1.length : 0;
                  const gapCount = Array.isArray(meta.gaps) ? meta.gaps.length : 0;
                  return (
                    <div className="mt-3 rounded-lg border border-border/60 bg-surface-2 px-3 py-2">
                      {meta.winning_angle && (
                        <p className="line-clamp-2 text-[11.5px] text-foreground">
                          {meta.winning_angle}
                        </p>
                      )}
                      <p className="mt-1 text-[10.5px] text-muted-foreground">
                        {tier1Count} direct competitor{tier1Count === 1 ? "" : "s"} mapped ·{" "}
                        {gapCount} gap{gapCount === 1 ? "" : "s"} found
                      </p>
                    </div>
                  );
                })()}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => downloadJSON(a)}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAsset(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
