import { Effect, Either, Option } from "effect";
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
    const metadataOpt = Option.fromNullable(
      session.metadata as unknown as CheckoutMetadata | null
    );

    if (Option.isNone(metadataOpt)) {
      console.error(
        "[stripe-webhook] Missing metadata on session:",
        session.id,
        "- ensure checkout was created via /api/checkout with metadata"
      );
    } else {
      const metadata = metadataOpt.value;
      if (!metadata.user_id || !metadata.pack_id || !metadata.tokens) {
        console.error(
          "[stripe-webhook] Missing required metadata (user_id, pack_id, tokens) on session:",
          session.id,
          "received:",
          JSON.stringify(metadata)
        );
      } else {
        const tokens = parseInt(metadata.tokens, 10);
        if (isNaN(tokens) || tokens <= 0) {
          console.error(
            "[stripe-webhook] Invalid tokens metadata:",
            metadata.tokens,
            "session:",
            session.id
          );
        } else {
          const supabase = await createServerClientInstance();
          const either = await Effect.runPromise(
            Effect.either(
              creditTokensForPurchase(
                supabase,
                metadata.user_id,
                session.id,
                metadata.pack_id,
                tokens
              )
            )
          );
          if (Either.isLeft(either)) {
            console.error(
              "[stripe-webhook] Failed to credit tokens:",
              either.left.message,
              "session:",
              session.id,
              "user_id:",
              metadata.user_id
            );
            return NextResponse.json(
              { error: "Token credit failed", detail: either.left.message },
              { status: 500 }
            );
          }
          console.log(
            `[stripe-webhook] Credited ${tokens} tokens to ${metadata.user_id}. New balance: ${either.right}`
          );
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
