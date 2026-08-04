"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import LoadingScreen from "@/components/ui/LoadingScreen";

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

  return <LoadingScreen message="Authenticating" />;
}

export default function DiscordCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Authenticating" />}>
      <CallbackHandler />
    </Suspense>
  );
}
