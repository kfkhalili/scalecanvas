"use client";

import { Effect, Either, Option } from "effect";
import { useEffect, useState, useCallback } from "react";
import { SquarePen, ShoppingCart } from "lucide-react";
import { fetchTokenBalance, initiateCheckout } from "@/services/checkoutClient";
import { toast } from "sonner";
import { TOKEN_PACKS } from "@/lib/stripe";

type PromptState = "loading" | "has_tokens" | "no_tokens";

export function NoSessionPrompt(): React.ReactElement {
  const [state, setState] = useState<PromptState>("loading");
  const [buyingOpt, setBuyingOpt] = useState<Option.Option<string>>(Option.none());

  const refresh = useCallback(() => {
    void Effect.runPromise(Effect.either(fetchTokenBalance())).then((either) =>
      Either.match(either, {
        onLeft: () => setState("no_tokens"),
        onRight: (tokens) => setState(tokens > 0 ? "has_tokens" : "no_tokens"),
      })
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBuy = async (packId: string): Promise<void> => {
    setBuyingOpt(Option.some(packId));
    const either = await Effect.runPromise(Effect.either(initiateCheckout(packId)));
    Either.match(either, {
      onLeft: (e) => {
        toast.error(e.message);
        setBuyingOpt(Option.none());
      },
      onRight: (url) => {
        window.location.href = url;
      },
    });
  };

  if (state === "loading") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground" />;
  }

  if (state === "has_tokens") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <SquarePen className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Click <strong className="text-foreground">New Session</strong> in the sidebar to start
          a mock interview.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <ShoppingCart className="size-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium text-foreground">Out of interview tokens</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase tokens to start practicing.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {TOKEN_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            disabled={Option.isSome(buyingOpt)}
            onClick={() => handleBuy(pack.id)}
            className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted focus:outline-none disabled:opacity-50"
          >
            <span className="font-medium text-foreground">{pack.label}</span>
            <span className="text-muted-foreground">${pack.priceUsd}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
