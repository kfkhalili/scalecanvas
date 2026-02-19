import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAANG-Trainer",
  description: "System design interview practice with AI interviewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
