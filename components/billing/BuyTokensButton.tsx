"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateCheckout } from "@/services/checkoutClient";
import { toast } from "sonner";
import { TOKEN_PACKS } from "@/lib/stripe";

type BuyTokensButtonProps = {
  className?: string;
};

export function BuyTokensButton({ className }: BuyTokensButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handlePurchase(packId: string): Promise<void> {
    setLoading(packId);
    const result = await initiateCheckout(packId);
    result.match(
      (url) => {
        window.location.href = url;
      },
      (e) => {
        toast.error(e.message);
        setLoading(null);
      }
    );
  }

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <ShoppingCart className="size-4" />
        <span>Buy Tokens</span>
      </Button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border bg-popover p-2 shadow-md">
          {TOKEN_PACKS.map((pack) => (
            <Button
              key={pack.id}
              variant="ghost"
              size="sm"
              disabled={loading !== null}
              onClick={() => handlePurchase(pack.id)}
              className="justify-between"
            >
              <span>{loading === pack.id ? "Redirecting..." : pack.label}</span>
              <span className="text-muted-foreground">${pack.priceUsd}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
