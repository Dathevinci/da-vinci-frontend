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

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SplashScreen from "@/components/ui/SplashScreen";
import AuthSync from "@/components/providers/AuthSync";
import MaintenanceOverlay from "@/components/ui/MaintenanceOverlay";
import { Suspense } from "react";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Da Vinci | Anime Tracker",
  description: "A modern, educational anime discovery platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-black text-slate-900 dark:text-white antialiased min-h-screen flex flex-col transition-colors duration-300">
        <ThemeProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <AuthSync />
            </Suspense>
            <MaintenanceOverlay />
            <SplashScreen />
            <Navbar />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
