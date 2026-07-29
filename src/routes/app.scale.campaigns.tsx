import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { generatedAssetsQuery } from "@/lib/queries";
import { Megaphone, FileText, ExternalLink, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/scale/campaigns")({
  component: ScaleCampaigns,
});

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "#7DD3FC",
  blog: "#A78BFA",
  landing: "#34D399",
  email: "#FB923C",
  pitch: "#0284c7",
  strategy: "#F5A623",
};

function categoryColor(category: string): string {
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (category?.toLowerCase().includes(k)) return v;
  }
  return "#9CA3AF";
}

function ScaleCampaigns() {
  const { currentOrgId } = useAuth();
  const assetsQ = useQuery({
    ...generatedAssetsQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const assets = (assetsQ.data ?? []) as Array<{
    id: string;
    title?: string;
    category?: string;
    tool_key?: string;
    created_at: string;
    content?: string;
  }>;

  const marketingAssets = assets.filter((a) => {
    const cat = a.category?.toLowerCase() ?? "";
    const tool = a.tool_key?.toLowerCase() ?? "";
    return (
      cat.includes("marketing") ||
      cat.includes("blog") ||
      cat.includes("landing") ||
      cat.includes("email") ||
      cat.includes("pitch") ||
      cat.includes("strategy") ||
      tool.includes("blog") ||
      tool.includes("landing") ||
      tool.includes("pitch") ||
      tool.includes("gtm") ||
      tool.includes("investor")
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] font-mono font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "rgba(125,211,252,0.65)" }}
          >
            ● Scale Mode · Campaigns
          </div>
          <h1
            className="font-display text-[20px] font-bold"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            Marketing Campaigns
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="text-[11px] font-mono px-3 py-1.5 rounded-xl"
            style={{
              background: "color-mix(in oklab, #7DD3FC 10%, transparent)",
              border: "1px solid color-mix(in oklab, #7DD3FC 25%, transparent)",
              color: "#7DD3FC",
            }}
          >
            {marketingAssets.length} assets
          </div>
          <Link
            to="/app/launchpad/$tool"
            params={{ tool: "blog" }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold btn-execute"
          >
            <Zap className="h-3.5 w-3.5" />
            Create Content
          </Link>
        </div>
      </div>

      {assetsQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="rounded-xl p-5 bylda-card animate-pulse"
              style={{ minHeight: 120 }}
            >
              <div
                className="h-4 rounded mb-3"
                style={{ background: "var(--surface-2)", width: "60%" }}
              />
              <div
                className="h-3 rounded mb-2"
                style={{ background: "var(--surface-2)", width: "90%" }}
              />
              <div
                className="h-3 rounded"
                style={{ background: "var(--surface-2)", width: "75%" }}
              />
            </div>
          ))}
        </div>
      ) : marketingAssets.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Megaphone
            className="h-10 w-10 mx-auto mb-4"
            style={{ color: "#7DD3FC", opacity: 0.6 }}
          />
          <h3
            className="font-display text-[16px] font-bold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            No campaign assets yet
          </h3>
          <p
            className="text-[13px] mb-6 max-w-sm mx-auto"
            style={{ color: "var(--muted-foreground)" }}
          >
            Run marketing tools to generate landing pages, blog posts, pitch decks, and email
            sequences.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { tool: "landing-page", label: "Landing Page" },
              { tool: "blog", label: "Blog Post" },
              { tool: "pitch-generator", label: "Pitch Deck" },
              { tool: "investor-emails", label: "Email Sequence" },
            ].map((item) => (
              <Link
                key={item.tool}
                to="/app/launchpad/$tool"
                params={{ tool: item.tool }}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-semibold bylda-card bylda-card-hover"
              >
                <ArrowRight className="h-3.5 w-3.5" style={{ color: "#7DD3FC" }} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketingAssets.map((asset) => {
            const color = categoryColor(asset.category ?? asset.tool_key ?? "");
            const label =
              asset.title ??
              (asset.tool_key ?? "Content")
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
            const preview = asset.content ? asset.content.slice(0, 120) + "…" : null;

            return (
              <div
                key={asset.id}
                className="rounded-xl p-4 bylda-card bylda-card-hover group flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{
                      background: `color-mix(in oklab, ${color} 12%, transparent)`,
                      border: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
                    }}
                  >
                    <FileText className="h-4 w-4" style={{ color }} />
                  </div>
                  <div
                    className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in oklab, ${color} 10%, transparent)`,
                      color,
                      border: `1px solid color-mix(in oklab, ${color} 22%, transparent)`,
                    }}
                  >
                    {asset.category ?? asset.tool_key ?? "Content"}
                  </div>
                </div>

                <h3
                  className="text-[13px] font-semibold mb-1.5 line-clamp-2"
                  style={{ color: "var(--foreground)" }}
                >
                  {label}
                </h3>

                {preview && (
                  <p
                    className="text-[11.5px] line-clamp-3 flex-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {preview}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(asset.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    to="/app/launchpad/$tool"
                    params={{ tool: asset.tool_key ?? "landing-page" }}
                    className="flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color }}
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
