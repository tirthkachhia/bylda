import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
  markClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  markClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative block h-9 w-9 shrink-0 overflow-hidden rounded-[11px] bg-black ring-1 ring-black/10 shadow-[0_8px_24px_rgba(9,12,18,0.16)]",
          markClassName,
        )}
      >
        <img
          src="/bylda-logo.png"
          alt="Bylda"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      {showWordmark && (
        <span className="text-[17px] font-bold tracking-[-0.035em] text-current">Bylda</span>
      )}
    </div>
  );
}
