// StageSpine — the persistent "you are here" path for the founder journey:
// Idea → Validate → Build → Launch → Operate. One shared, labelled spine so the
// user always sees where they are and what's ahead (audit Part 1 Q4).
//
// Accent-driven and theme-flexible: pass CSS custom-property values in the app
// (var(--primary)…) or raw colors on the token-free onboarding screen. Purely
// presentational — the caller owns which stage is current.

import React from "react";

export interface SpineStageDef {
  id: string;
  label: string;
}

export const FOUNDER_STAGES: SpineStageDef[] = [
  { id: "idea", label: "Idea" },
  { id: "validate", label: "Validate" },
  { id: "build", label: "Build" },
  { id: "launch", label: "Launch" },
  { id: "operate", label: "Operate" },
];

export function StageSpine({
  currentIndex,
  stages = FOUNDER_STAGES,
  accent = "var(--primary)",
  doneColor,
  mutedColor = "rgba(247,240,232,0.32)",
  trackColor = "rgba(247,240,232,0.14)",
  labelColor = "rgba(247,240,232,0.72)",
}: {
  /** Index of the current stage. Stages before it are done, after it upcoming. */
  currentIndex: number;
  stages?: SpineStageDef[];
  accent?: string;
  /** Colour for completed stages; defaults to accent. */
  doneColor?: string;
  mutedColor?: string;
  trackColor?: string;
  labelColor?: string;
}) {
  const done = doneColor ?? accent;

  return (
    <div
      role="list"
      aria-label="Your founder journey — you are here"
      style={{ display: "flex", alignItems: "flex-start", width: "100%" }}
    >
      {stages.map((s, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
        const dotColor = state === "upcoming" ? "transparent" : state === "done" ? done : accent;
        return (
          <React.Fragment key={s.id}>
            <div
              role="listitem"
              aria-current={state === "current" ? "step" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                width: 56,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: dotColor,
                  border:
                    state === "upcoming"
                      ? `1.5px solid ${trackColor}`
                      : `1.5px solid ${state === "current" ? accent : done}`,
                  boxShadow:
                    state === "current"
                      ? `0 0 0 4px color-mix(in oklab, ${accent} 22%, transparent)`
                      : "none",
                  transition: "all 0.3s ease",
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: state === "current" ? 800 : 600,
                  letterSpacing: "0.01em",
                  color:
                    state === "upcoming" ? mutedColor : state === "current" ? accent : labelColor,
                  whiteSpace: "nowrap",
                  transition: "color 0.3s ease",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span
                aria-hidden
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 5,
                  borderRadius: 2,
                  background: i < currentIndex ? done : trackColor,
                  transition: "background 0.3s ease",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
