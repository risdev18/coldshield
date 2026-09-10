import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "ChillShield AI — Predictive Cold-Chain Risk Platform",
  description:
    "AI-powered cold-chain risk prediction and decision support for logistics operators. Monitor, predict, simulate and prevent cargo spoilage.",
  keywords: "cold chain, logistics, AI, temperature monitoring, spoilage prevention, pharmaceutical",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "Inter, sans-serif",
              fontSize: "13.5px",
            },
          }}
        />
      </body>
    </html>
  );
}
