import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/lib/auth";
import { invokeEdge } from "@/lib/invokeEdge";
type Price = {
  lookup_key: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
};
export function BillingPlans({ existingSubscription }: { existingSubscription: boolean }) {
  const { currentOrgId } = useAuth();
  const q = useQuery({
    queryKey: ["billing-price-catalog", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () =>
      invokeEdge<{ prices: Price[] }>(
        "coaching-billing-catalog",
        { organization_id: currentOrgId, environment: getStripeEnvironment() },
        { retries: 0 },
      ),
  });
  const [secret, setSecret] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stripe = useMemo(() => {
    if (!secret) return null;
    try {
      return getStripe();
    } catch {
      return null;
    }
  }, [secret]);
  async function checkout(price: Price) {
    if (existingSubscription) return;
    setBusy(true);
    setError("");
    try {
      const r = await invokeEdge<{ clientSecret: string }>(
        "create-checkout",
        {
          organizationId: currentOrgId,
          priceId: price.lookup_key,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/app/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        },
        { retries: 0 },
      );
      setSecret(r.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not start.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-5 space-y-3">
      <h2>Available billing products</h2>
      <p className="text-xs">
        Prices below come from the configured Stripe environment. Review the checkout before
        confirming payment. Existing subscribers should use Manage billing to change their plan.
      </p>
      {q.error ? (
        <p role="alert">
          Billing products could not load.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      ) : q.isPending ? (
        <p>Loading prices…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data?.prices.map((p) => (
            <article key={p.lookup_key} className="rounded border p-4">
              <h3>{p.name}</h3>
              <p className="my-2">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: p.currency,
                }).format(
                  p.amount /
                    10 **
                      (new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: p.currency,
                      }).resolvedOptions().maximumFractionDigits ?? 2),
                )}{" "}
                / {p.interval_count > 1 ? `${p.interval_count} ` : ""}
                {p.interval}
              </p>
              <button
                className="figma-button"
                disabled={busy || existingSubscription}
                onClick={() => void checkout(p)}
              >
                Review checkout
              </button>
            </article>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {secret && stripe ? (
        <div>
          <button className="figma-button mb-3" onClick={() => setSecret(null)}>
            Close checkout
          </button>
          <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret: secret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : secret ? (
        <p role="alert">
          Checkout was created, but the public Stripe client key is missing for this environment.
        </p>
      ) : null}
    </section>
  );
}
