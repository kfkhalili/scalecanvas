import { Option } from "effect";
import Stripe from "stripe";

let _stripeOpt: Option.Option<Stripe> = Option.none();

export function getStripeClient(): Stripe {
  return Option.match(_stripeOpt, {
    onNone: () => {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error("Missing STRIPE_SECRET_KEY environment variable");
      }
      const client = new Stripe(key, {
        apiVersion: "2026-01-28.clover",
        typescript: true,
      });
      _stripeOpt = Option.some(client);
      return client;
    },
    onSome: (s) => s,
  });
}

export type TokenPack = {
  readonly id: string;
  readonly tokens: number;
  readonly label: string;
  readonly priceUsd: number;
  readonly priceEnvKey: string;
};

export const TOKEN_PACKS: readonly TokenPack[] = [
  { id: "pack_3", tokens: 3, label: "3 Interviews", priceUsd: 14, priceEnvKey: "STRIPE_PRICE_ID_3" },
  { id: "pack_10", tokens: 10, label: "10 Interviews", priceUsd: 29, priceEnvKey: "STRIPE_PRICE_ID_10" },
  { id: "pack_25", tokens: 25, label: "25 Interviews", priceUsd: 49, priceEnvKey: "STRIPE_PRICE_ID_25" },
] as const;

export function getPackById(packId: string): Option.Option<TokenPack> {
  return Option.fromNullable(TOKEN_PACKS.find((p) => p.id === packId));
}

export function getStripePriceId(pack: TokenPack): Option.Option<string> {
  return Option.fromNullable(process.env[pack.priceEnvKey]);
}
