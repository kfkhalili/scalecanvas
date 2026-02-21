import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });
  return _stripe;
}

export type TokenPack = {
  readonly id: string;
  readonly tokens: number;
  readonly label: string;
  readonly priceEnvKey: string;
};

export const TOKEN_PACKS: readonly TokenPack[] = [
  { id: "pack_5", tokens: 5, label: "5 Interviews", priceEnvKey: "STRIPE_PRICE_ID_5" },
  { id: "pack_15", tokens: 15, label: "15 Interviews", priceEnvKey: "STRIPE_PRICE_ID_15" },
  { id: "pack_50", tokens: 50, label: "50 Interviews", priceEnvKey: "STRIPE_PRICE_ID_50" },
] as const;

export function getPackById(packId: string): TokenPack | undefined {
  return TOKEN_PACKS.find((p) => p.id === packId);
}

export function getStripePriceId(pack: TokenPack): string | undefined {
  return process.env[pack.priceEnvKey];
}
