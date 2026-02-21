import { ok, err, type Result } from "neverthrow";

type CheckoutError = { message: string };

export async function fetchTokenBalance(): Promise<Result<number, CheckoutError>> {
  try {
    const res = await fetch("/api/tokens/balance");
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return err({ message: data.error ?? "Failed to fetch token balance" });
    }
    const json = (await res.json()) as { tokens: number };
    return ok(json.tokens);
  } catch (e) {
    return err({ message: e instanceof Error ? e.message : "Network error" });
  }
}

export async function initiateCheckout(
  packId: string
): Promise<Result<string, CheckoutError>> {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: packId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return err({ message: data.error ?? "Failed to create checkout session" });
    }
    const json = (await res.json()) as { url: string };
    return ok(json.url);
  } catch (e) {
    return err({ message: e instanceof Error ? e.message : "Network error" });
  }
}
