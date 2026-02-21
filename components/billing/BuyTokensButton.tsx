"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateCheckout } from "@/services/checkoutClient";
import { toast } from "sonner";

const PACKS = [
  { id: "pack_5", label: "5 Interviews", tokens: 5 },
  { id: "pack_15", label: "15 Interviews", tokens: 15 },
  { id: "pack_50", label: "50 Interviews", tokens: 50 },
] as const;

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
          {PACKS.map((pack) => (
            <Button
              key={pack.id}
              variant="ghost"
              size="sm"
              disabled={loading !== null}
              onClick={() => handlePurchase(pack.id)}
              className="justify-start"
            >
              {loading === pack.id ? "Redirecting..." : pack.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
