import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "card" | "inline";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        variant === "card" && "rounded-xl p-12",
        className,
      )}
      style={
        variant === "card"
          ? {
              background: "var(--surface)",
              border: "1px dashed var(--border)",
            }
          : undefined
      }
    >
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-xl mb-5"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <Icon className="h-5 w-5" style={{ color: "var(--muted-foreground)", opacity: 0.6 }} />
      </span>

      <h3 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
        {title}
      </h3>
      {description && (
        <p
          className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
