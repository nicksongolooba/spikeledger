// Stripe server-side client + a single isConfigured() check used by API routes
// and UI: when the env keys aren't set we degrade gracefully — billing routes
// return 503 with a friendly note rather than crashing.

import Stripe from "stripe";

const SECRET = process.env.STRIPE_SECRET_KEY ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!SECRET) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }
  if (!_stripe) {
    _stripe = new Stripe(SECRET, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return SECRET.length > 0;
}

export function isWebhookConfigured(): boolean {
  return WEBHOOK_SECRET.length > 0;
}

export function getWebhookSecret(): string {
  if (!WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not configured.");
  }
  return WEBHOOK_SECRET;
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
