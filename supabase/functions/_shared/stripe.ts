import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "npm:stripe@18.5.0";

export type StripeEnv = "sandbox" | "live";

export function getConnectionApiKey(env: StripeEnv): string {
  const key =
    env === "sandbox"
      ? Deno.env.get("STRIPE_SANDBOX_API_KEY")
      : Deno.env.get("STRIPE_LIVE_API_KEY");
  if (!key) throw new Error(`STRIPE_${env.toUpperCase()}_API_KEY is not configured`);
  return key;
}

export function createStripeClient(env: StripeEnv): Stripe {
  const apiKey = getConnectionApiKey(env);
  // Use Stripe SDK directly — no third-party gateway
  return new Stripe(apiKey, { apiVersion: "2024-06-20" });
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!secret) throw new Error("Webhook secret not configured");
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");
  return JSON.parse(body);
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
