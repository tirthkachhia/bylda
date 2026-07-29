import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const environment: "sandbox" | "live" = clientToken?.startsWith("pk_test_") ? "sandbox" : "live";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment() {
  return environment;
}

export function isPaymentsEnabled() {
  return !!clientToken;
}

export async function createCheckoutSession(opts: {
  priceId: string;
  customerEmail?: string;
  userId?: string;
  organizationId?: string;
  returnUrl?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { ...opts, environment },
  });
  if (error || !data?.clientSecret) {
    throw new Error(error?.message || "Failed to create checkout session");
  }
  return data.clientSecret as string;
}
