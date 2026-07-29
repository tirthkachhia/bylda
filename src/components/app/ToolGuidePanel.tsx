// ToolGuidePanel — the hand-holding strip inside every guided tool page.
// Before the user generates anything, it tells them in plain words what this
// tool is, why it matters, the 3 moves to make, and how they know they're
// done. Disappears once output exists, so results get the full screen.

import { Clock } from "lucide-react";
import { getStepGuidance } from "@/lib/step-execution-guidance";

const IN_TOOL_DIRECTIONS = [
  { action: "Fill in the boxes on the left.", detail: "Use simple words. Short answers are fine." },
  {
    action: 'Click the "Generate with AI" button.',
    detail: "Bylda does the writing — it takes about a minute.",
  },
  {
    action: "Read the result on the right.",
    detail: "Change anything that sounds wrong, then save it.",
  },
];

export function ToolGuidePanel({ toolKey }: { toolKey: string }) {
  const guidance = getStepGuidance(toolKey);
  if (!guidance) return null;

  return (
    <div
      className="overflow-hidden rounded-[6px] border"
      style={{
        borderColor: "var(--primary-border)",
        borderLeft: "4px solid var(--primary)",
        background: "var(--surface)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-2.5"
        style={{
          background: "var(--primary-soft)",
          borderBottom: "1px solid var(--primary-border)",
        }}
      >
        <span
          className="text-[11.5px] font-extrabold uppercase tracking-[0.08em]"
          style={{ color: "var(--primary)" }}
        >
          Bylda guides you — here's how this works
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Clock className="h-3 w-3" />
          about {guidance.minutes} minutes
        </span>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        <div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--foreground)" }}>
            {guidance.plainWhat}
          </p>
          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            <b style={{ color: "var(--foreground)", fontWeight: 700 }}>Why this matters: </b>
            {guidance.why}
          </p>

          <div
            className="mt-3 rounded-[4px] border px-3.5 py-2.5"
            style={{
              background: "color-mix(in oklab, var(--success) 7%, var(--surface))",
              borderColor: "color-mix(in oklab, var(--success) 30%, transparent)",
              borderLeft: "3px solid var(--success)",
            }}
          >
            <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--success)" }}>
              You are done when:
            </div>
            <ul className="space-y-0.5">
              {guidance.doneWhen.map((c, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--foreground)" }}
                >
                  <span className="font-extrabold" style={{ color: "var(--success)" }}>
                    ✓
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[12px] font-bold" style={{ color: "var(--foreground)" }}>
            How to do it — 3 small steps:
          </div>
          <div
            className="overflow-hidden rounded-[4px] border"
            style={{ borderColor: "var(--border)" }}
          >
            {IN_TOOL_DIRECTIONS.map((d, i) => (
              <div
                key={i}
                className="flex items-stretch"
                style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <div
                  className="flex w-9 shrink-0 items-center justify-center text-[12.5px] font-extrabold"
                  style={{
                    color: "var(--primary)",
                    background: "var(--primary-soft)",
                    borderRight: "1px solid var(--primary-border)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="px-3 py-2 text-[12.5px] leading-relaxed">
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    {d.action}
                  </span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>{d.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
