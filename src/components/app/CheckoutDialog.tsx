import { useCallback, useMemo } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, createCheckoutSession } from "@/lib/stripe";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  priceId: string | null;
  customerEmail?: string;
  userId?: string;
  organizationId?: string;
};

export function CheckoutDialog({
  open,
  onOpenChange,
  priceId,
  customerEmail,
  userId,
  organizationId,
}: Props) {
  const stripePromise = useMemo(() => (open && priceId ? getStripe() : null), [open, priceId]);

  const fetchClientSecret = useCallback(async () => {
    if (!priceId) throw new Error("No price selected");
    return createCheckoutSession({
      priceId,
      customerEmail,
      userId,
      organizationId,
      returnUrl: `${window.location.origin}/app/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  }, [priceId, customerEmail, userId, organizationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-display text-base font-semibold tracking-tight">
            Complete your subscription
          </DialogTitle>
        </DialogHeader>
        <div className="p-2">
          {open && priceId && stripePromise && (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
