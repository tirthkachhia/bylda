import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn, Wordmark } from "@/components/bylda";

/**
 * Shared frame for A6–A10 (Figma 26:784 · 15:2 · 15:302 · 26:496 · 16:21).
 * Left: the 300px graphite step rail. Right: the step column at x=380 on the pearl canvas.
 * Figma's 4mm grid overlay is left out, as on A1–A5 (§13.2: no gradients).
 */

export const ONBOARDING_STEPS = [
  "Your workspace",
  "Teach Bylda how you sell",
  "Connect calls",
  "Invite your team",
  "First analysis",
] as const;

function StepRail({ current }: { current: number }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col gap-7 overflow-hidden bg-by-surface-sidebar px-7 py-8 lg:flex">
      <Wordmark className="text-[30px] text-by-text-on-dark" />
      <ol className="flex w-full flex-col">
        {ONBOARDING_STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 py-3",
                active || done ? "text-by-text-on-dark" : "text-by-text-on-dark-muted",
              )}
            >
              <span className={cn("type-mono-data shrink-0", !done && "w-[15px]")}>
                {done ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span className={active ? "type-ui-body-strong" : "type-ui-body"}>{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex-1" />
      <p className="type-ui-small text-by-text-on-dark-muted">
        Setup takes ~8 minutes. First analysis runs while you invite the team.
      </p>
    </aside>
  );
}

export function OnboardingLayout({
  step,
  width = 680,
  top = 64,
  aside,
  children,
}: {
  /** 0-based index into ONBOARDING_STEPS. */
  step: number;
  /** Column width from the frame (640–760). */
  width?: number;
  /** Column top from the frame (56–80px) — the aside card always sits at y=120. */
  top?: number;
  /** Optional right-hand card (A7 "What this changes"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-by-surface-canvas">
      <StepRail current={step} />
      <main
        className="flex flex-1 gap-[60px] px-4 pb-16 sm:px-10 lg:pl-20"
        style={{ paddingTop: top }}
      >
        <div className="flex w-full flex-col items-start gap-5" style={{ maxWidth: width }}>
          {children}
        </div>
        {aside ? (
          <div className="hidden w-[300px] shrink-0 xl:block" style={{ paddingTop: 120 - top }}>
            {aside}
          </div>
        ) : null}
      </main>
    </div>
  );
}

/** "STEP 1 OF 5" + Editorial/H1 title + lead. */
export function StepHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
}) {
  return (
    <>
      <p className="type-mono-micro uppercase text-by-text-tertiary">{eyebrow}</p>
      <h1 className="type-editorial-h1 text-by-text-primary">{title}</h1>
      {lead ? <p className="type-ui-body text-by-text-secondary">{lead}</p> : null}
    </>
  );
}

/** UI/Label caption, optionally with a mono hint on the right. */
export function FieldLabel({
  children,
  hint,
  htmlFor,
  strong,
}: {
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  /** A7's section labels are text/primary; A6's form labels text/secondary. */
  strong?: boolean;
}) {
  const cls = cn(
    "type-ui-label flex-1 uppercase",
    strong ? "text-by-text-primary" : "text-by-text-secondary",
  );
  return (
    <div className="flex w-full items-start gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cls}>
          {children}
        </label>
      ) : (
        <span className={cls}>{children}</span>
      )}
      {hint ? <span className="type-mono-micro text-by-text-tertiary">{hint}</span> : null}
    </div>
  );
}

/** Pill choice — ink when selected, white + strong hairline otherwise. */
export function Chip({
  selected,
  onClick,
  children,
  role = "checkbox",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  role?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "type-ui-small whitespace-nowrap rounded-by-pill border px-2.5 py-[5px] transition-colors duration-200 ease-by-out",
        selected
          ? "border-by-surface-rail bg-by-surface-rail text-by-text-on-dark"
          : "border-by-border-strong bg-by-surface-raised text-by-text-secondary hover:text-by-text-primary",
      )}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex w-full flex-wrap gap-1.5">
      {children}
    </div>
  );
}

/** Native select in the A6 input frame (⌄ glyph on the right). */
export function SelectField({
  id,
  label,
  placeholder,
  options,
  error,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  error?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div
        className={cn(
          "relative flex w-full items-center rounded-by-control border bg-by-surface-raised transition-colors duration-200 ease-by-out",
          error
            ? "border-by-feedback-error"
            : "border-by-border-strong focus-within:border-by-focus-ring",
        )}
      >
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className="type-ui-body w-full appearance-none bg-transparent px-3 py-2.5 pr-8 text-by-text-primary outline-none invalid:text-by-text-tertiary"
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="type-mono-micro pointer-events-none absolute right-3 text-by-text-tertiary"
        >
          ⌄
        </span>
      </div>
      {error ? (
        <p role="alert" className="type-mono-micro text-by-feedback-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Inset note with a mono eyebrow — "WHY WE ASK", "REP PRIVACY DEFAULT", "ALREADY VISIBLE". */
export function InsetNote({
  label,
  children,
  role,
}: {
  label: string;
  children: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex w-full flex-col gap-1 rounded-by-card border border-by-border-engraved bg-by-surface-inset px-4 py-3"
    >
      <span className="type-mono-micro uppercase text-by-text-tertiary">{label}</span>
      <div className="type-ui-small text-by-text-primary">{children}</div>
    </div>
  );
}

/** Back / Skip + primary, bottom of each step. */
export function StepActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}
