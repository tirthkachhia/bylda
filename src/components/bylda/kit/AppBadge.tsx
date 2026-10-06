import { cn } from "./cn";

/** Badge / APP (39:965) — marks a message posted by Bylda. */
export function AppBadge({ label = "APP", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "type-mono-micro inline-flex rounded-by-badge bg-by-surface-muted px-[5px] py-px text-by-text-secondary",
        className,
      )}
    >
      {label}
    </span>
  );
}
