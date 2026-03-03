"use client";

import { Effect, Either, Option } from "effect";
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { SquarePen, Coins } from "lucide-react";
import { toast } from "sonner";
import { fetchTokenBalance, initiateCheckout } from "@/services/checkoutClient";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { deductTokenAndCreateSession } from "@/services/tokensClient";
import { useSessionStore } from "@/stores/sessionStore";
import { TOKEN_PACKS } from "@/lib/stripe";

type DialogState =
  | { kind: "closed" }
  | { kind: "confirm"; balance: number }
  | { kind: "no_tokens" }
  | { kind: "creating" }
  | { kind: "buying"; packId: string };

type NewSessionButtonProps = {
  sidebarOpen: boolean;
};

export function NewSessionButton({ sidebarOpen }: NewSessionButtonProps): React.ReactElement {
  const router = useRouter();
  const { setCurrentSessionId } = useSessionStore();
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [balanceOpt, setBalanceOpt] = useState<Option.Option<number>>(Option.none());

  const refreshBalance = useCallback(() => {
    void Effect.runPromise(Effect.either(fetchTokenBalance())).then((either) =>
      Either.match(either, {
        onLeft: () => setBalanceOpt(Option.none()),
        onRight: (tokens) => setBalanceOpt(Option.some(tokens)),
      })
    );
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleClick = (): void => {
    if (Option.isNone(balanceOpt)) {
      setDialog({ kind: "no_tokens" });
    } else {
      const tokens = balanceOpt.value;
      setDialog(tokens > 0 ? { kind: "confirm", balance: tokens } : { kind: "no_tokens" });
    }
    // Refresh balance in the background so the dialog value stays fresh
    refreshBalance();
  };

  const handleConfirm = async (): Promise<void> => {
    setDialog({ kind: "creating" });
    const supabase = createBrowserClientInstance();
    const either = await Effect.runPromise(
      Effect.either(deductTokenAndCreateSession(supabase))
    );
    Either.match(either, {
      onLeft: (e) => {
        toast.error(e.message);
        setDialog({ kind: "closed" });
      },
      onRight: (sessionId) => {
        setCurrentSessionId(Option.some(sessionId));
        setBalanceOpt((prev) =>
          Option.match(prev, {
            onNone: () => Option.none(),
            onSome: (n) => Option.some(n - 1),
          })
        );
        setDialog({ kind: "closed" });
        router.push(`/${sessionId}`);
      },
    });
  };

  const handleBuy = async (packId: string): Promise<void> => {
    setDialog({ kind: "buying", packId });
    const either = await Effect.runPromise(Effect.either(initiateCheckout(packId)));
    Either.match(either, {
      onLeft: (e) => {
        toast.error(e.message);
        setDialog({ kind: "no_tokens" });
      },
      onRight: (url) => {
        window.location.href = url;
      },
    });
  };

  const close = (): void => {
    setDialog({ kind: "closed" });
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const openBuyTokens = (): void => {
    setDialog({ kind: "no_tokens" });
    refreshBalance();
  };

  useEffect(() => {
    if (dialog.kind === "closed") return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog.kind]);

  const isDialogOpen =
    dialog.kind === "confirm" ||
    dialog.kind === "no_tokens" ||
    dialog.kind === "creating" ||
    dialog.kind === "buying";

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={dialog.kind === "creating"}
          aria-label="New session"
          className="flex h-10 min-w-0 flex-1 items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-sm text-foreground/80 transition-colors hover:bg-muted focus:outline-none disabled:opacity-60"
        >
          <SquarePen className="h-5 w-5 shrink-0" />
          {sidebarOpen && <span className="overflow-hidden">New session</span>}
        </button>
        {sidebarOpen &&
          Option.match(balanceOpt, {
            onNone: () => (
              <button
                type="button"
                onClick={openBuyTokens}
                aria-label="View token balance and buy more"
                className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Coins className="size-3.5" />
                —
              </button>
            ),
            onSome: (balance) => (
              <button
                type="button"
                onClick={openBuyTokens}
                aria-label={`${balance} tokens. Click to buy more.`}
                className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Coins className="size-3.5" />
                {balance}
              </button>
            ),
          })}
      </div>

      {isDialogOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-session-dialog-title"
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
          >
            <div className="absolute inset-0 bg-black/50" aria-hidden onClick={close} />
            <div className="relative z-10 w-full max-w-md rounded-xl border bg-popover p-6 shadow-xl">
              {(dialog.kind === "confirm" || dialog.kind === "creating") && (
                <>
                  <h2 id="new-session-dialog-title" className="text-lg font-semibold text-foreground">
                    Start a new interview?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This will use 1 token.{" "}
                    {dialog.kind === "confirm" && (
                      <>
                        You have{" "}
                        <strong className="text-foreground">{dialog.balance}</strong>{" "}
                        remaining.
                      </>
                    )}
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={close}
                      disabled={dialog.kind === "creating"}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={dialog.kind === "creating"}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none disabled:opacity-50"
                    >
                      {dialog.kind === "creating" ? "Starting..." : "Start Interview"}
                    </button>
                  </div>
                </>
              )}

              {(dialog.kind === "no_tokens" || dialog.kind === "buying") && (
                <>
                  <h2 id="new-session-dialog-title" className="text-lg font-semibold text-foreground">
                    Buy more tokens
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Purchase interview tokens to practice system design interviews.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {TOKEN_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        disabled={dialog.kind === "buying"}
                        onClick={() => handleBuy(pack.id)}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted focus:outline-none disabled:opacity-50"
                      >
                        <span className="font-medium text-foreground">{pack.label}</span>
                        <span className="text-muted-foreground">${pack.priceUsd}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={close}
                      disabled={dialog.kind === "buying"}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
