/**
 * AiOriginCard — the one shared "Bylda is speaking" surface.
 *
 * Any AI-generated fragment across the app (suggested reply, next-best-action
 * nudge, mentor insight, a casefile's "Bylda's Take") renders through this
 * single component so the AI-origin visual grammar — a violet left border, a
 * soft violet field, and a Sparkles eyebrow — is byte-for-byte identical on
 * every surface. Do not fork per-screen variants; extend the props here.
 */
import { Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AiOriginCard({
  label = "Bylda",
  icon: Icon = Sparkles,
  title,
  children,
  action,
  compact = false,
  className = "",
}: {
  /** Eyebrow text — who/what is speaking (e.g. "Bylda", "Bylda's Take", "Suggested reply"). */
  label?: string;
  /** Eyebrow icon; defaults to Sparkles. */
  icon?: LucideIcon;
  /** Optional bold lead line above the body. */
  title?: ReactNode;
  /** Body content. */
  children?: ReactNode;
  /** Optional footer action (a Link/button). */
  action?: ReactNode;
  /** Tighter padding for dense/inline contexts (CRM rows, list items). */
  compact?: boolean;
  /** Extra classes on the container (spacing only — do not override the grammar). */
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border shadow-sm ${compact ? "p-3" : "p-4"} ${className}`}
      style={{
        borderColor: "var(--primary-border)",
        borderLeft: "4px solid var(--primary)",
        background: "var(--primary-soft)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--primary)" }}
        >
          {label}
        </span>
      </div>
      {title && (
        <p
          className={`${compact ? "mt-1 text-[13px]" : "mt-1.5 text-sm"} font-semibold leading-snug`}
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </p>
      )}
      {children && (
        <div
          className={`${title ? "mt-1" : "mt-1.5"} ${compact ? "text-[12.5px]" : "text-sm"} leading-relaxed`}
          style={{ color: "var(--muted-foreground)" }}
        >
          {children}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
