/**
 * CrmNextBestAction — Bylda's single highest-leverage CRM move, rendered as an
 * AI-origin nudge at the top of the pipeline.
 *
 * Reads the org-wide next-best-action copilot (edge fn scores stalled deals,
 * unreplied inbound, at-risk accounts, forecast gaps) and surfaces the #1
 * ranked action through the shared AiOriginCard so it carries the exact same
 * violet grammar as every other place Bylda speaks. Renders nothing when there's
 * no org, no actions (fresh/empty CRM), or the call fails — never a broken box.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { invokeEdge } from "@/lib/invokeEdge";
import { AiOriginCard } from "@/components/bylda/AiOriginCard";

type NbaAction = {
  kind: string;
  title: string;
  detail: string;
  score: number;
  entity_type: string;
  entity_id: string;
};

export function CrmNextBestAction({
  orgId,
  className = "",
  onAct,
}: {
  orgId: string | null;
  className?: string;
  /** Called with the top action when the user clicks the CTA (e.g. open the deal). */
  onAct?: (action: NbaAction) => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  const q = useQuery({
    queryKey: ["crm-nba", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await invokeEdge<{ ok: boolean; actions: NbaAction[] }>("next-best-action", {
        org_id: orgId,
      });
      return res.actions ?? [];
    },
    // A copilot nudge is non-critical: never retry-storm or surface an error box.
    retry: false,
  });

  const top = q.data?.[0];
  if (dismissed || !top) return null;

  return (
    <AiOriginCard
      className={className}
      label="Next best action"
      title={top.title}
      action={
        <div className="flex items-center gap-3">
          {onAct && top.entity_type === "lead" && (
            <button
              onClick={() => onAct(top)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              Open deal <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        </div>
      }
    >
      {top.detail}
    </AiOriginCard>
  );
}
