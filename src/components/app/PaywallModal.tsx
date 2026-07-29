import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Sparkles, Check } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
};

export function PaywallModal({
  open,
  onOpenChange,
  title = "You've used your 3 free validations",
  description = "Upgrade to Launch to unlock unlimited access and all 17 AI tools.",
  ctaLabel = "Upgrade to Launch — $49/mo",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center font-display text-[18px] font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-[13px] text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2/60 p-4 text-[12.5px]">
          {[
            "Unlimited AI tool runs",
            "All 17 AI tools unlocked",
            "Pitch, GTM, Offer, Ops Plan & more",
            "Priority generation queue",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-foreground/90">
              <Check className="h-3.5 w-3.5 text-success" /> {f}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2">
          <Link to="/app/billing">
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              {ctaLabel}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
