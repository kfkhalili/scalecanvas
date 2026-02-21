import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import type { CheckoutMetadata } from "@/lib/stripe.types";
import { createServerClientInstance } from "@/lib/supabase/server";
import { creditTokensForPurchase } from "@/services/tokens";

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signature verification failed";
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata as unknown as CheckoutMetadata | null;

    if (!metadata?.user_id || !metadata?.pack_id || !metadata?.tokens) {
      console.error("[stripe-webhook] Missing metadata on session:", session.id);
      return NextResponse.json({ received: true });
    }

    const tokens = parseInt(metadata.tokens, 10);
    if (isNaN(tokens) || tokens <= 0) {
      console.error("[stripe-webhook] Invalid tokens metadata:", metadata.tokens);
      return NextResponse.json({ received: true });
    }

    const supabase = await createServerClientInstance();
    const result = await creditTokensForPurchase(
      supabase,
      metadata.user_id,
      session.id,
      metadata.pack_id,
      tokens
    );

    result.match(
      (newBalance) => {
        console.log(
          `[stripe-webhook] Credited ${tokens} tokens to ${metadata.user_id}. New balance: ${newBalance}`
        );
      },
      (e) => {
        console.error("[stripe-webhook] Failed to credit tokens:", e.message);
      }
    );
  }

  return NextResponse.json({ received: true });
}
