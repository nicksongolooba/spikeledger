import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

// Brand type. Barlow for reading, Barlow Condensed for headlines and
// scoreboard numbers. Self-hosted through next/font (no runtime request to
// Google) and exposed as CSS variables that tailwind.config.ts maps to
// `font-sans` and `font-display`.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpikeLedger - Volleyball stats that are fair to every position",
  description:
    "Courtside stat entry, the position-fair Bank Account, and report cards parents actually understand. Built by a club volleyball coach.",
  applicationName: "SpikeLedger",
};

export const viewport: Viewport = {
  themeColor: "#0b1a33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
