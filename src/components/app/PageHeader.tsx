import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 pb-5 border-b border-border",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary mb-2">
            <span className="opacity-50">[</span> {eyebrow} <span className="opacity-50">]</span>
          </p>
        )}
        <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between mb-3", className)}>
      <div>
        <h2 className="font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-foreground/90">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 normal-case font-sans tracking-normal">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
