import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { CheckoutFeedback } from "@/components/billing/CheckoutFeedback";
import { getBaseUrl } from "@/lib/seo";
import "./globals.css";

const siteName = "ScaleCanvas";
const title = `${siteName} — System design interview practice`;
const description =
  "Practice system design and coding interviews with an AI interviewer. ScaleCanvas helps you prepare for FAANG-style technical interviews.";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: baseUrl ? new URL(baseUrl) : undefined,
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  keywords: [
    "system design interview",
    "technical interview",
    "AI interviewer",
    "FAANG",
    "coding interview practice",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    siteName,
    title,
    description,
    locale: "en",
    url: baseUrl ? `${baseUrl}/` : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const websiteJsonLd = (url: string) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  description,
  url,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const canonicalUrl = baseUrl ? `${baseUrl}/` : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {canonicalUrl && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(websiteJsonLd(canonicalUrl)),
            }}
          />
        )}
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
