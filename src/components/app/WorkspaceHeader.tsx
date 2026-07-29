import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--primary-soft)" }}
          >
            <Icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="font-bold leading-tight"
            style={{
              fontSize: "clamp(1.25rem, 2vw + 0.75rem, 1.75rem)",
              color: "var(--foreground)",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
