import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { PwaBootstrap } from "@/components/pwa/pwa-bootstrap";
import { AuthProvider } from "@/hooks/use-auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TradIQ — Smart Investment Platform",
  description:
    "Grow your wealth with AI copy trading bots, QR Ph deposits, and multi-level referral rewards. Built for Filipino investors.",
  icons: {
    icon: "/assets/icon-192.png",
    apple: "/assets/icon-512.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full`}>
      <body className="min-h-full bg-black">
        <AuthProvider>
          <PwaBootstrap />
          {children}
          <Toaster theme="dark" position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
