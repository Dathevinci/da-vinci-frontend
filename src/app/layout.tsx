import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * EVERY font face is SELF-HOSTED from src/app/fonts — latin-subset woff2,
 * the variable file wherever the family has one. This replaced
 * next/font/google on 2026-08-11: that pipeline re-downloads every family
 * on every Vercel build, and a builder-side breakage (Module not found:
 * '@vercel/turbopack-next/internal/font/google/font', surfacing first as a
 * Lexend fetch failure, then EB Garamond) killed consecutive deploys with
 * zero code at fault. Local files build deterministically, offline.
 * The CSS variables are IDENTICAL to before — nothing downstream moved.
 */
import localFont from "next/font/local";

const geistSans = localFont({ src: "./fonts/geist-latin.woff2", weight: "100 900", variable: "--font-geist-sans" });
const geistMono = localFont({ src: "./fonts/geist-mono-latin.woff2", weight: "100 900", variable: "--font-geist-mono" });
const permanentMarker = localFont({ src: "./fonts/permanent-marker-latin.woff2", weight: "400", variable: "--font-graffiti" });
const cinzel = localFont({ src: "./fonts/cinzel-latin.woff2", weight: "400 900", variable: "--font-cinzel" });
const fellEnglish = localFont({ src: "./fonts/im-fell-english-sc-latin.woff2", weight: "400", variable: "--font-fell" });

// The landing wordmark's face — the heavy condensed grotesque of the Lunar
// reference. Anton ships one weight; it is inherently black.
const anton = localFont({ src: "./fonts/anton-latin.woff2", weight: "400", variable: "--font-anton", display: "swap" });

// Classic Renaissance book serif for elegant, da Vinci-era typography.
const ebGaramond = localFont({
  src: [
    { path: "./fonts/eb-garamond-latin.woff2", style: "normal" },
    { path: "./fonts/eb-garamond-latin-italic.woff2", style: "italic" },
  ],
  weight: "400 800",
  variable: "--font-garamond",
});

// Reading faces for the novel chapter reader's font picker, plus Dungeon
// Dispatch's arcade face. preload off — they only download when a reader
// actually picks them; zero cost to every other page.
const pressStart = localFont({ src: "./fonts/press-start-2p-latin.woff2", weight: "400", variable: "--font-pixel", display: "swap", preload: false });
// Blackletter display face for the FEATURED novel's title only — preload:false
// so its 8.8KB downloads solely on pages that actually render it.
const pirataOne = localFont({ src: "./fonts/pirata-one-latin.woff2", weight: "400", variable: "--font-pirata", display: "swap", preload: false });
const lora = localFont({
  src: [
    { path: "./fonts/lora-latin.woff2", style: "normal" },
    { path: "./fonts/lora-latin-italic.woff2", style: "italic" },
  ],
  weight: "400 700", variable: "--font-lora", display: "swap", preload: false,
});
const merriweather = localFont({
  src: [
    { path: "./fonts/merriweather-latin.woff2", style: "normal" },
    { path: "./fonts/merriweather-latin-italic.woff2", style: "italic" },
  ],
  weight: "400 700", variable: "--font-merriweather", display: "swap", preload: false,
});
const literata = localFont({
  src: [
    { path: "./fonts/literata-latin.woff2", style: "normal" },
    { path: "./fonts/literata-latin-italic.woff2", style: "italic" },
  ],
  weight: "400 700", variable: "--font-literata", display: "swap", preload: false,
});
const lexend = localFont({ src: "./fonts/lexend-latin-var.woff2", weight: "100 900", variable: "--font-lexend", display: "swap", preload: false });

import Navbar from "@/components/layout/Navbar";
import ScrollReset from "@/components/layout/ScrollReset";
import BrowseAnchor from "@/components/layout/BrowseAnchor";
import ModeTransition from "@/components/layout/ModeTransition";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SupportUsModal from "@/components/layout/SupportUsModal";
import AuthSync from "@/components/providers/AuthSync";
import MaintenanceOverlay from "@/components/ui/MaintenanceOverlay";
import ServiceNotice from "@/components/ui/ServiceNotice";
import InviteOnlyGuard from "@/components/layout/InviteOnlyGuard";
import { Suspense } from "react";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import AppMotionConfig from "@/components/providers/AppMotionConfig";
import { ToastProvider } from "@/components/ui/Toast";
import AnimeModalProvider from "@/components/providers/AnimeModalProvider";
import ManhwaModalProvider from "@/components/providers/ManhwaModalProvider";
import NovelModalProvider from "@/components/providers/NovelModalProvider";

import { AppModeProvider } from "@/components/providers/AppModeProvider";

export const metadata: Metadata = {
  title: "Da Vinci",
  description: "A modern, educational anime discovery platform.",
  applicationName: "Da Vinci",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // Lets iOS "Add to Home Screen" launch fullscreen like an app, too.
  appleWebApp: { capable: true, title: "Da Vinci", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${permanentMarker.variable} ${cinzel.variable} ${ebGaramond.variable} ${fellEnglish.variable} ${anton.variable} ${pressStart.variable} ${pirataOne.variable} ${lora.variable} ${merriweather.variable} ${literata.variable} ${lexend.variable} bg-[#050505] text-white antialiased min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden`}>
        <ThemeProvider>
          <AppMotionConfig>
          <AppModeProvider>
            <ModeTransition />
            <ToastProvider>
              <AnimeModalProvider>
                <ManhwaModalProvider>
                  <NovelModalProvider>
                  <Suspense fallback={null}>
                    <AuthSync />
                  </Suspense>

                  {/* Frontend-only outage notice — shows even when the backend
                      is down, and for signed-out visitors on the gate. */}
                  <ServiceNotice />

                  <InviteOnlyGuard>
                    <SupportUsModal />
                    <MaintenanceOverlay />
                    <Navbar />
                    {/* Opens every page at the top of it — see the component
                        for why the router's own reset misses. Renders nothing. */}
                    <ScrollReset />
                    {/* Remembers the last browse page so the readers — which
                        have no persistent nav of their own — can offer one tap
                        back to it. Renders nothing. */}
                    <BrowseAnchor />
                    <main className="flex-1 pb-20 md:pb-0">{children}</main>
                    <Footer />
                    <MobileBottomNav />
                  </InviteOnlyGuard>
                  </NovelModalProvider>
                </ManhwaModalProvider>
              </AnimeModalProvider>
            </ToastProvider>
          </AppModeProvider>
          </AppMotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
