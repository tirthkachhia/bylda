import { Fragment } from "react";
import { cn } from "@/components/bylda";

export function G1CoachingLifecycle() {
  const steps = [
    "Insight selected",
    "Evidence attached",
    "Focus assigned",
    "Rep acknowledges",
    "Rep applies on calls",
    "Bylda measures",
    "Result: held / not yet / reverted",
  ];
  return (
    <section
      aria-label="Coaching lifecycle"
      className="flex min-h-[70px] min-w-[1450px] items-center gap-2.5 border border-by-border-engraved bg-by-surface-raised px-6 py-4 text-by-text-primary"
    >
      <h2 className="type-display-label whitespace-nowrap text-by-text-secondary">
        COACHING = 4 OBJECTS, NOT AN LMS
      </h2>
      <ol className="flex items-center gap-2.5">
        {steps.map((step, i) => (
          <Fragment key={step}>
            {i > 0 && (
              <li aria-hidden="true" className="type-ui-small text-by-text-tertiary">
                →
              </li>
            )}
            <li
              className={cn(
                "type-ui-small whitespace-nowrap border border-by-border-engraved px-2.5 py-1.5",
                i === 5 ? "bg-by-surface-rail text-by-text-on-dark" : "bg-by-surface-inset",
              )}
            >
              {step}
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
