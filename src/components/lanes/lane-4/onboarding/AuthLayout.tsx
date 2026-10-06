import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn, Wordmark } from "@/components/bylda";

/**
 * Shared frame for A1–A5 (Figma 26:40 · 26:91 · 26:139 · 26:184 · 26:224).
 * Left: the 620px ink art panel (rings + rays + glyph + tagline). Right: a 440px form column
 * at x=760, y=200 on the pearl canvas.
 */

/** Ring diameters from the frame — 120px, then +70px per ring, all centred on (310, 520). */
const RINGS = Array.from({ length: 9 }, (_, i) => 120 + i * 70);
/** Rays fan from (310, 200) — straight down, sweeping through the right side in 15° steps. */
const RAYS = Array.from({ length: 12 }, (_, i) => i * -15);

function ArtPanel() {
  return (
    <aside className="relative hidden w-[620px] shrink-0 overflow-hidden bg-by-surface-rail lg:block">
      <div className="absolute inset-x-0 top-0 h-[1024px]" aria-hidden>
        {RINGS.map((d) => (
          <div
            key={d}
            className="absolute rounded-by-pill border border-by-border-rail opacity-60"
            style={{ width: d, height: d, left: 310 - d / 2, top: 520 - d / 2 }}
          />
        ))}
        {RAYS.map((deg) => (
          <div
            key={deg}
            className="absolute left-[310px] top-[200px] h-[640px] w-[0.75px] origin-top bg-by-border-rail opacity-50"
            style={{ transform: `rotate(${deg}deg)` }}
          />
        ))}
        <svg
          width={64}
          height={56}
          viewBox="0 0 64 56"
          fill="none"
          className="absolute left-[278px] top-[490px] text-by-text-on-dark"
        >
          <path d="M32 1 62.5 42H1.5L32 1Z" stroke="currentColor" strokeWidth={1} />
        </svg>
      </div>
      <Wordmark className="absolute left-14 top-14 text-[30px] text-by-text-on-dark" />
      <p className="type-editorial-h2 absolute left-14 top-[860px] w-[460px] text-by-text-on-dark">
        Understand your sales team without listening to every call.
      </p>
    </aside>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-by-surface-canvas">
      <ArtPanel />
      <main className="flex-1 px-4 pb-16 pt-20 sm:px-10 lg:pl-[140px] lg:pt-[200px]">
        <div className="flex w-full max-w-[440px] flex-col items-start gap-[18px]">{children}</div>
      </main>
    </div>
  );
}

export function AuthTitle({ children }: { children: ReactNode }) {
  return <h1 className="type-editorial-h1 text-by-text-primary">{children}</h1>;
}

export function AuthLead({ children }: { children: ReactNode }) {
  return <p className="type-ui-body text-by-text-secondary">{children}</p>;
}

/** Mono footnote — hints, legal, "SSO / SAML" line. */
export function AuthMicro({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("type-mono-micro text-by-text-tertiary", className)}>{children}</p>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Rendered inside the input frame, right-aligned (e.g. the "Forgot?" link). */
  trailing?: ReactNode;
};

/** Labelled text input (UI/Label caption · 12/10 padding · hairline → ink on focus). */
export const AuthField = forwardRef<HTMLInputElement, FieldProps>(function AuthField(
  { label, hint, error, trailing, id, className, ...rest },
  ref,
) {
  const inputId = id ?? `auth-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const msgId = `${inputId}-msg`;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={inputId} className="type-ui-label uppercase text-by-text-secondary">
        {label}
      </label>
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-by-control border bg-by-surface-raised px-3 py-2.5 transition-colors duration-200 ease-by-out",
          error
            ? "border-by-feedback-error"
            : "border-by-border-strong focus-within:border-by-focus-ring",
        )}
      >
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={cn(
            "type-ui-body min-w-0 flex-1 bg-transparent text-by-text-primary outline-none placeholder:text-by-text-tertiary",
            className,
          )}
          {...rest}
        />
        {trailing}
      </div>
      {error ? (
        <p id={msgId} role="alert" className="type-mono-micro text-by-feedback-error">
          {error}
        </p>
      ) : hint ? (
        <AuthMicro className="w-full">
          <span id={msgId}>{hint}</span>
        </AuthMicro>
      ) : null}
    </div>
  );
});

/** "── OR ──" divider between OAuth buttons and the email form. */
export function OrDivider() {
  return (
    <div className="flex w-full items-center gap-2.5" role="separator">
      <span className="h-px flex-1 bg-by-border-engraved" />
      <span className="type-mono-micro text-by-text-tertiary">OR</span>
      <span className="h-px flex-1 bg-by-border-engraved" />
    </div>
  );
}

/** Inset note — used for A4's "Sent state" and form-level messages. */
export function AuthNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex w-full flex-col gap-1 border border-by-border-engraved bg-by-surface-inset px-4 py-3"
    >
      <span className="type-mono-micro uppercase text-by-text-tertiary">{label}</span>
      <p className="type-ui-small text-by-text-primary">{children}</p>
    </div>
  );
}
