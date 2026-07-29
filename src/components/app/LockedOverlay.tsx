import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function LockedOverlay({
  requiredPlan,
  className,
}: {
  requiredPlan?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 rounded-[inherit] bg-background/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4",
        className,
      )}
    >
      <div className="h-8 w-8 rounded-md border border-border bg-surface grid place-items-center mb-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {requiredPlan ? `Available on ${requiredPlan}` : "Upgrade required"}
      </p>
      <Button asChild size="sm" variant="default">
        <Link to="/app/billing">Upgrade to unlock</Link>
      </Button>
    </div>
  );
}
