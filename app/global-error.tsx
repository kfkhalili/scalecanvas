"use client";

import { useEffect } from "react";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps): React.ReactElement {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          A critical error occurred. Please refresh the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
