"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDiscordUser } = useUser();

  useEffect(() => {
    const data = searchParams.get("data");
    const error = searchParams.get("error");

    if (error) {
      alert("Failed to login with Discord.");
      router.push("/");
      return;
    }

    if (data) {
      try {
        const decodedUser = JSON.parse(atob(data));
        setDiscordUser(decodedUser);
        router.push("/");
      } catch (err) {
        console.error("Failed to parse user data from Discord", err);
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [searchParams, router, setDiscordUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white font-bold tracking-widest uppercase">Authenticating...</p>
      </div>
    </div>
  );
}

export default function DiscordCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
