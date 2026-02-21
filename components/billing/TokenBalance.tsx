"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins } from "lucide-react";
import { fetchTokenBalance } from "@/services/checkoutClient";

type TokenBalanceProps = {
  className?: string;
};

export function TokenBalance({ className }: TokenBalanceProps): React.ReactElement {
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetchTokenBalance().then((r) =>
      r.match(
        (tokens) => setBalance(tokens),
        () => setBalance(null)
      )
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (balance === null) return <></>;

  return (
    <div className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className ?? ""}`}>
      <Coins className="size-4" />
      <span>{balance}</span>
    </div>
  );
}
