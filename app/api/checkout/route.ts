import { Effect, Either, Option } from "effect";
import { NextResponse } from "next/server";
import { createServerClientInstance } from "@/lib/supabase/server";
import { getStripeClient, getPackById, getStripePriceId } from "@/lib/stripe";
import type { CheckoutMetadata } from "@/lib/stripe.types";
import { getOrCreateStripeCustomerId, saveStripeCustomerId } from "@/services/tokens";
import { CheckoutBodySchema } from "@/lib/api.schemas";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CheckoutBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const pack = getPackById(parsed.data.pack_id);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack_id" }, { status: 400 });
  }

  const priceId = getStripePriceId(pack);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this pack" },
      { status: 503 }
    );
  }

  const stripe = getStripeClient();

  const existingEither = await Effect.runPromise(
    Effect.either(getOrCreateStripeCustomerId(supabase, user.id))
  );
  if (Either.isLeft(existingEither)) {
    return NextResponse.json(
      { error: existingEither.left.message },
      { status: 500 }
    );
  }
  const existingOption = existingEither.right;

  let stripeCustomerId: string;
  if (Option.isSome(existingOption)) {
    stripeCustomerId = existingOption.value;
  } else {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    const saveEither = await Effect.runPromise(
      Effect.either(saveStripeCustomerId(supabase, user.id, stripeCustomerId))
    );
    if (Either.isLeft(saveEither)) {
      return NextResponse.json(
        { error: saveEither.left.message },
        { status: 500 }
      );
    }
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const metadata: CheckoutMetadata = {
    pack_id: pack.id,
    user_id: user.id,
    tokens: String(pack.tokens),
  };

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    client_reference_id: user.id,
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
