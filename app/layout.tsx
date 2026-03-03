import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CheckoutFeedback } from "@/components/billing/CheckoutFeedback";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScaleCanvas",
  description: "System design interview practice with AI interviewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Suspense>
          <CheckoutFeedback />
        </Suspense>
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
