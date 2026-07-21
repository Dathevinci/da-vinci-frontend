import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Permanent_Marker, Cinzel, EB_Garamond, IM_Fell_English_SC } from "next/font/google";

const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-graffiti",
});

const cinzel = Cinzel({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-cinzel",
});

const fellEnglish = IM_Fell_English_SC({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fell",
});

// Classic Renaissance book serif for elegant, da Vinci-era typography.
const ebGaramond = EB_Garamond({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-garamond",
});

import Navbar from "@/components/layout/Navbar";
import ModeTransition from "@/components/layout/ModeTransition";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SplashScreen from "@/components/ui/SplashScreen";
import SupportUsModal from "@/components/layout/SupportUsModal";
import AuthSync from "@/components/providers/AuthSync";
import MaintenanceOverlay from "@/components/ui/MaintenanceOverlay";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${permanentMarker.variable} ${cinzel.variable} ${ebGaramond.variable} ${fellEnglish.variable} bg-[#050505] text-white antialiased min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden`}>
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

                  <InviteOnlyGuard>
                    <SupportUsModal />
                    <MaintenanceOverlay />
                    <SplashScreen />
                    <Navbar />
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
