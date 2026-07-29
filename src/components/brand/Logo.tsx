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
      <div className="relative h-7 w-7 overflow-hidden rounded-lg border border-primary/30 bylda-glow bylda-sky-mark grid place-items-center">
        {/* Sky-island mark: a sun over a floating cloud */}
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          {/* sun */}
          <circle cx="16" cy="8" r="3" className="bylda-sun" fill="currentColor" />
          {/* floating island / cloud */}
          <path
            d="M4 16c0-1.9 1.6-3.4 3.5-3.4.3 0 .6 0 .9.1A3.6 3.6 0 0 1 15 13a2.8 2.8 0 0 1 2.6 2.8c0 .2 0 .3-.1.5H4.3A2 2 0 0 1 4 16Z"
            className="bylda-cloud"
            fill="currentColor"
          />
        </svg>
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
