import { cn } from "@/lib/utils";

/**
 * Section header for app pages.
 * Renamed from "MissionHeader" semantics to a clean SaaS page header,
 * but the export name is preserved for backward compatibility.
 */
export function MissionHeader({
  label,
  title,
  description,
  actions,
  className,
}: {
  label: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  // Strip legacy tactical prefixes/suffixes from existing call sites
  const cleanLabel = label
    .replace(/^MISSION:\s*/i, "")
    .replace(/^INTELLIGENCE\s*[—-]\s*/i, "")
    .replace(/^VAULT\s*[—-]\s*/i, "")
    .replace(/^OPERATIONS\s*[—-]\s*/i, "")
    .replace(/^BYLDA OS\s*[—-]\s*AUTOMATION COMMAND/i, "Bylda OS")
    .replace(/[—-]\s*AUTOMATION COMMAND$/i, "")
    .replace(/[—-]\s*LEAD TRACKER$/i, "")
    .replace(/[—-]\s*GENERATED ASSETS$/i, "")
    .replace(/[—-]\s*CONTROL PANEL$/i, "");

  return (
    <div className={cn("flex flex-col gap-3 pb-1", className)}>
      <div className="text-[11px] font-medium uppercase tracking-[0.10em] text-muted-foreground">
        {cleanLabel}
      </div>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h1 className="font-display text-[1.55rem] font-semibold tracking-tight md:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({
  variant,
  label,
  live = false,
}: {
  variant: "active" | "online" | "standby" | "locked" | "soon";
  label?: string;
  live?: boolean;
}) {
  const cls =
    variant === "active" || variant === "online"
      ? "status-active"
      : variant === "standby"
        ? "status-standby"
        : variant === "soon"
          ? "status-soon"
          : "status-locked";
  const text =
    label ??
    (variant === "active"
      ? "Active"
      : variant === "online"
        ? "Online"
        : variant === "standby"
          ? "Standby"
          : variant === "soon"
            ? "Coming soon"
            : "Locked");
  return (
    <span className={cn("status-badge", cls)}>
      <span className={cn("dot", live && "live")} />
      {text}
    </span>
  );
}

export function XpBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("xp-bar", className)}>
      <div className="xp-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DifficultyBadge({ level }: { level: "Beginner" | "Intermediate" | "Advanced" }) {
  const tone =
    level === "Beginner"
      ? "border-success/30 text-success bg-success/10"
      : level === "Intermediate"
        ? "border-primary/30 text-primary bg-primary/10"
        : "border-warning/40 text-warning bg-warning/10";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {level}
    </span>
  );
}
