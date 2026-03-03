"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function CheckoutFeedback(): React.ReactElement | null {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    if (checkout === "success") {
      shown.current = true;
      toast.success(
        "Payment successful! Your tokens will be added in a moment—refresh if your balance doesn’t update."
      );
    } else if (checkout === "cancel") {
      shown.current = true;
      toast.info("Checkout was cancelled.");
    }
  }, [checkout]);

  return null;
}
