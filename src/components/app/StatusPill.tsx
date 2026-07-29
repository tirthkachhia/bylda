import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "success" | "warning" | "destructive" | "muted";

const TONES: Record<Tone, string> = {
  default: "border-border bg-surface text-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary",
  success:
    "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  warning:
    "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/30 text-muted-foreground",
};

export function StatusPill({
  children,
  tone = "default",
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-foreground/60": tone === "default",
            "bg-primary": tone === "primary",
            "bg-[color:var(--success)]": tone === "success",
            "bg-[color:var(--warning)]": tone === "warning",
            "bg-destructive": tone === "destructive",
            "bg-muted-foreground": tone === "muted",
          })}
        />
      )}
      {children}
    </span>
  );
}
