"use client";
import { SessionProvider } from "next-auth/react";
import DiscordSync from "./DiscordSync";

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DiscordSync />
      {children}
    </SessionProvider>
  );
}
