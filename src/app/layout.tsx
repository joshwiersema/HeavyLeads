import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const siteUrl = "https://heavy-leads.vercel.app";

export const metadata: Metadata = {
  title: "GroundPulse",
  description:
    "GroundPulse aggregates construction permits, government bids, and project news into a single scored feed — so your sales team reaches the right jobsite first.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "GroundPulse - Construction Lead Intelligence for Every Trade",
    description:
      "GroundPulse aggregates construction permits, government bids, and project news into a single scored feed — so your sales team reaches the right jobsite first.",
    url: siteUrl,
    siteName: "GroundPulse",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GroundPulse - Construction Lead Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GroundPulse - Construction Lead Intelligence for Every Trade",
    description:
      "GroundPulse aggregates construction permits, government bids, and project news into a single scored feed — so your sales team reaches the right jobsite first.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
        >
          Skip to main content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
