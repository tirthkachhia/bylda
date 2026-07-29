/**
 * AutomationOpportunities — turns the operator's stated bottlenecks (from the
 * Business Context Graph) into ranked, named automation suggestions with the
 * WHY attached. This is the closed loop in miniature: intake answers →
 * concrete deployable systems, instead of a flat catalog of toggles.
 */

import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { businessContextQuery } from "@/lib/queries";

interface Suggestion {
  system: string;
  systemName: string;
  reason: string;
}

// bottleneck id (from operator intake) → automation system mapping
const BOTTLENECK_SYSTEMS: Record<string, { slug: string; name: string; pitch: string }[]> = {
  "Lead flow": [
    {
      slug: "lead-qualification",
      name: "Lead Qualification",
      pitch: "qualify and route every lead the moment it arrives",
    },
    {
      slug: "ai-appointment-setting",
      name: "AI Appointment Setting",
      pitch: "turn qualified leads into booked calls 24/7",
    },
  ],
  "Sales conversion": [
    {
      slug: "ai-followup-sequences",
      name: "AI Follow-Up Sequences",
      pitch: "deals close on touch 5-8 — stop doing those touches by hand",
    },
  ],
  "Fulfillment / delivery": [
    {
      slug: "crm-automation",
      name: "CRM Automation",
      pitch: "move clients through delivery stages without manual updates",
    },
  ],
  "Churn / retention": [
    {
      slug: "ai-followup-sequences",
      name: "AI Follow-Up Sequences",
      pitch: "automated check-ins catch churn signals before customers leave",
    },
  ],
  "Founder time": [
    {
      slug: "voice-ai",
      name: "Voice AI",
      pitch: "answer and qualify calls so they stop interrupting your day",
    },
    {
      slug: "sms-automation",
      name: "SMS Automation",
      pitch: "handle the routine back-and-forth without you",
    },
  ],
  "Reporting / visibility": [
    {
      slug: "crm-automation",
      name: "CRM Automation",
      pitch: "structured pipeline data is what makes your reports real",
    },
  ],
};

export function AutomationOpportunities() {
  const { currentOrgId } = useAuth();
  const ctxQ = useQuery({
    ...businessContextQuery(currentOrgId ?? ""),
    enabled: !!currentOrgId,
  });

  const motion =
    ctxQ.data?.motion && typeof ctxQ.data.motion === "object"
      ? (ctxQ.data.motion as Record<string, unknown>)
      : {};
  const bottlenecks = Array.isArray(motion.bottlenecks) ? (motion.bottlenecks as string[]) : [];

  if (bottlenecks.length === 0) return null;

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const b of bottlenecks) {
    for (const sys of BOTTLENECK_SYSTEMS[b] ?? []) {
      if (seen.has(sys.slug)) continue;
      seen.add(sys.slug);
      suggestions.push({
        system: sys.slug,
        systemName: sys.name,
        reason: `You said "${b}" slows you down — ${sys.pitch}.`,
      });
    }
    if (suggestions.length >= 3) break;
  }

  if (suggestions.length === 0) return null;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: "color-mix(in oklab, var(--warning) 30%, var(--border))",
        background: "color-mix(in oklab, var(--warning) 4%, transparent)",
      }}
    >
      <div
        className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--warning)" }}
      >
        <Lightbulb className="h-3 w-3" /> Opportunities — ranked against your bottlenecks
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {suggestions.slice(0, 3).map((s, i) => (
          <div
            key={s.system}
            className="rounded-xl border p-3.5"
            style={{
              borderColor:
                i === 0 ? "color-mix(in oklab, var(--warning) 40%, transparent)" : "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{s.systemName}</span>
              {i === 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                  style={{
                    background: "color-mix(in oklab, var(--warning) 16%, transparent)",
                    color: "var(--warning)",
                  }}
                >
                  Top pick
                </span>
              )}
            </div>
            <p
              className="mt-1.5 text-[11.5px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {s.reason}
            </p>
            <div className="mt-2 text-[11px]" style={{ color: "var(--warning)" }}>
              ↓ Deploy it below
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
