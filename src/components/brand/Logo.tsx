import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_4px_16px_rgba(29,34,53,0.22)]">
        <img src="/bylda-logo.png" alt="" className="h-full w-full object-cover" />
        <div className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-primary bylda-live-dot" />
      </div>
      {showWordmark && (
        <div className="leading-none">
          <span className="font-mono text-[13px] font-semibold tracking-[0.2em] uppercase text-foreground">
            Bylda
          </span>
        </div>
      )}
    </div>
  );
}
