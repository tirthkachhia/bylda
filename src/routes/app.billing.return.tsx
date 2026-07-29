import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/billing/return")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const { session_id } = useSearch({ from: "/app/billing/return" });
  const qc = useQueryClient();
  const { currentOrgId } = useAuth();

  useEffect(() => {
    // Webhook may take a couple seconds; poll a few times.
    const ids = [800, 2000, 4000].map((ms) =>
      setTimeout(() => {
        if (currentOrgId) {
          qc.invalidateQueries({ queryKey: ["subscription", currentOrgId] });
        }
      }, ms),
    );
    return () => ids.forEach(clearTimeout);
  }, [currentOrgId, qc]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Payment successful</h1>
      <p className="text-[13px] text-muted-foreground">
        Your plan is being activated. This usually takes a few seconds.
      </p>
      {session_id && (
        <p className="text-[11px] text-muted-foreground/70">Ref: {session_id.slice(-12)}</p>
      )}
      <div className="mt-2 flex gap-2">
        <Link to="/app/billing">
          <Button variant="outline">Back to billing</Button>
        </Link>
        <Link to="/app">
          <Button>Go to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
