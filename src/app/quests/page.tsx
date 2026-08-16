"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * The quest board moved onto the owner's profile — one place for everything
 * personal instead of a separate page for each card.
 *
 * This route stays alive as a REDIRECT because half the app links here (the
 * hub tile, both docks, the navbar, the nav island) and people have it in
 * muscle memory and bookmarks. Redirecting is one hop; retraining every link
 * and every habit is churn with no payoff.
 */
export default function QuestsRedirect() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user?.username) {
      router.replace(`/user/${encodeURIComponent(user.username)}#quests`);
    } else {
      // Signed out there is nothing to show — quests are personal.
      router.replace("/");
    }
  }, [isLoaded, user?.username, router]);

  return <LoadingScreen message="Opening your quests" />;
}
