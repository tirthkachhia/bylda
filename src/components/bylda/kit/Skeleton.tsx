import { cn } from "./cn";

/** Static skeleton bars (Y13, "NO SHIMMER THEATRICS"). Never animated. */
export function SkeletonBar({
  width,
  height = 12,
  className,
}: {
  width: number | string;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("block rounded-by-bar bg-by-surface-muted", className)}
      style={{ width, height }}
      aria-hidden
    />
  );
}

export function SkeletonBlock({ height = 52, className }: { height?: number; className?: string }) {
  return (
    <span
      className={cn("block w-full bg-by-surface-inset", className)}
      style={{ height }}
      aria-hidden
    />
  );
}
