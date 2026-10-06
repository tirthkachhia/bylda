import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-by-control bg-by-surface-control-dark/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
