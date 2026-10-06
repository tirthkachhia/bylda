import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SystemState, cn } from "@/components/bylda";

/** Page padding shared by every Intelligence screen (Figma Main: 36 / 28, gap 20). */
export function IntelligenceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 px-9 pb-7 pt-7 max-[1024px]:px-6">{children}</div>
  );
}

/**
 * The page-19 Intelligence tabs (Figma 27:394). Each is its own route, so the URL is shareable
 * and the prototype's Flow 9 lands on the right one. A count renders only once its hook has
 * answered — never a placeholder number.
 */
const TABS = [
  { key: "today", to: "/app/intelligence", label: "Important today" },
  { key: "patterns", to: "/app/intelligence/patterns", label: "Emerging patterns" },
  { key: "behaviors", to: "/app/intelligence/team-behaviors", label: "Team behaviors" },
  { key: "objections", to: "/app/intelligence/objections", label: "Objections" },
  { key: "methodology", to: "/app/intelligence/methodology", label: "Methodology" },
  { key: "outcomes", to: "/app/intelligence/outcomes", label: "Outcome patterns" },
  { key: "reps", to: "/app/intelligence/reps", label: "Rep patterns" },
  { key: "prospects", to: "/app/intelligence/prospects", label: "Prospect patterns" },
] as const;

export type IntelligenceTabKey = (typeof TABS)[number]["key"];

export function IntelligenceTabs({
  counts = {},
}: {
  counts?: Partial<Record<IntelligenceTabKey, number | null>>;
}) {
  return (
    <nav
      aria-label="Intelligence tabs"
      className="flex w-full items-start gap-[18px] overflow-x-auto border-b border-by-border-engraved"
    >
      {TABS.map((t) => {
        const n = counts[t.key];
        return (
          <Link
            key={t.key}
            to={t.to}
            activeOptions={{ exact: true }}
            className="group -mb-px flex shrink-0 items-start gap-1.5 border-b-[1.5px] border-transparent py-2 text-by-text-secondary transition-colors duration-200 ease-out hover:text-by-text-primary data-[status=active]:border-by-text-primary data-[status=active]:text-by-text-primary"
          >
            <span className="type-ui-body whitespace-nowrap group-data-[status=active]:type-ui-body-strong">
              {t.label}
            </span>
            {n != null ? <span className="type-mono-micro text-by-text-tertiary">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Intelligence team views compare reps, so a rep sees this instead (hooks refuse them). */
export function RestrictedState({ eyebrow }: { eyebrow: string }) {
  return (
    <SystemState
      eyebrow={eyebrow}
      tag={{ tone: "neutral", label: "Restricted" }}
      title="Intelligence is for managers."
      body="It compares reps, so it isn’t shown in a rep view. Your own progress lives on your home."
      actions={[{ label: "Go to my home", variant: "secondary", href: "/app/rep" }]}
    />
  );
}

/** Mono eyebrow + label rows used in the context panel (Figma 27:526). */
export function FactRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-b border-by-border-engraved py-2 last:border-b-0",
        className,
      )}
    >
      <span className="type-mono-micro w-[86px] shrink-0 text-by-text-tertiary">{label}</span>
      <span className="type-ui-small min-w-0 flex-1 text-by-text-primary">{children}</span>
    </div>
  );
}
