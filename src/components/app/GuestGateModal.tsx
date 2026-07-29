import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGuest } from "@/lib/guest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

export function GuestGateModal() {
  const { gateOpen, gateReason, closeGate } = useGuest();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignUp = () => {
    setLoading(true);
    closeGate();
    navigate({ to: "/signup", search: { plan: undefined } });
  };

  return (
    <Dialog
      open={gateOpen}
      onOpenChange={(o) => {
        if (!o) {
          closeGate();
          setLoading(false);
        }
      }}
    >
      <DialogContent className="overflow-hidden border-border bg-card p-0 sm:max-w-md">
        <button
          onClick={() => {
            closeGate();
            setLoading(false);
          }}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>

          <h2 className="mt-5 font-display text-[20px] font-semibold tracking-tight">
            Create your account to continue
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {gateReason ??
              "You're exploring Bylda in demo mode. Create a free account to run AI tools, save assets, and track real leads."}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={handleSignUp} className="w-full" disabled={loading}>
              {loading ? "Redirecting…" : "Sign up free"}
            </Button>
            <Button
              variant="ghost"
              onClick={closeGate}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Continue exploring
            </Button>
          </div>

          <div className="mt-5 text-[11px] text-muted-foreground">
            Demo mode · No account needed to look around
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
