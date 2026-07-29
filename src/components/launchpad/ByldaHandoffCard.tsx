// The Launchpad → Bylda handoff — the graduation moment, not a mode toggle.
// Shown on Launchpad Home only once the build is proven (idea validated,
// offer priced, plan written, leads live). Bylda inherits every decision:
// niche, offer, ICP, plan, memory. Copy contract: "You built the business.
// Now run it."

import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Gauge, CheckCircle2 } from "lucide-react";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { PRODUCT_HOME } from "@/lib/ecosystem";
import type { BusinessGraph } from "@/hooks/use-business-graph";

export function ByldaHandoffCard({ graph }: { graph: BusinessGraph }) {
  const { setMode } = useWorkspaceMode();
  const navigate = useNavigate();

  const openBylda = () => {
    setMode("operate");
    navigate({ to: PRODUCT_HOME.bylda });
  };

  const inherited = [
    graph.signals.hasValidatedIdea && "Validated idea",
    graph.signals.hasOffer && "Offer & pricing",
    graph.signals.hasGtm && "Customer plan",
    graph.signals.leadCount > 0 && `${graph.signals.leadCount} live leads`,
    graph.signals.hasFollowupSequence && "Follow-up sequence",
  ].filter((x): x is string => !!x);

  return (
    <div
      className="rounded-[6px] border px-5 py-4 md:px-6 md:py-5"
      style={{
        background: "color-mix(in oklab, var(--cyan) 8%, var(--surface))",
        borderColor: "color-mix(in oklab, var(--cyan) 35%, transparent)",
        borderLeft: "3px solid var(--cyan)",
      }}
    >
      <div
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em]"
        style={{ color: "var(--cyan)" }}
      >
        <Gauge className="h-3.5 w-3.5" />
        Ready to operate
      </div>
      <h2
        className="mt-1.5 text-[18px] font-bold leading-tight"
        style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
      >
        You built the business. Now run it.
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        Bylda built your operating system from your Launchpad decisions — everything you proved here
        is already live over there.
      </p>

      {inherited.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {inherited.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: "var(--muted-foreground)" }}
            >
              <CheckCircle2 className="h-3 w-3" style={{ color: "var(--success)" }} />
              {item}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={openBylda}
        className="mt-4 inline-flex items-center gap-2 rounded-[5px] px-4 py-2 text-[13px] font-bold transition-opacity hover:opacity-90"
        style={{
          background: "var(--cyan)",
          color: "var(--background)",
        }}
      >
        Open Bylda
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
