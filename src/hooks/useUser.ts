"use client";

import { useState, useEffect, useRef } from "react";
import { authHeaders, setAuthToken } from "@/lib/authToken";
import { clearAccountProgress } from "@/lib/readingProgress";

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bannerUrl?: string;
  bannerPosition?: number;
  bannerStyle?: string;
  bio?: string;
  profileSong?: string;
  arisePoints?: number;
  xp?: number;
  usernameChanges?: number;
  role?: string; // LEAD_DEV | ADMIN | USER — persists across username changes
  theme?: string;
  followers?: any[];
  following?: any[];
  
  purchasedBanners?: string[];
  purchasedTags?: string[];
  purchasedRoles?: string[];
  purchasedEffects?: string[];
  purchasedThemes?: string[];
  purchasedColors?: string[];
  purchasedFonts?: string[];
  purchasedFrames?: string[];

  activeRole?: string;
  activeTag?: string;
  activeEffect?: string;
  activeTheme?: string;
  activeColor?: string;
  activeFont?: string;
  activeFrame?: string;
}

let isSyncing = false;

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  /**
   * The raw JSON this instance last applied.
   *
   * `davinci_user_updated` is a broadcast: EVERY mounted useUser answers it.
   * A profile page can have dozens of them (each tracked card carries one via
   * its tracker button), and the handler used to JSON.parse the whole user
   * blob — followers, following, purchased* arrays and all — then setUser with
   * a brand-new object identity every time. New identity means a re-render,
   * and it means any effect keyed on `user` tears down and re-registers. So a
   * single routine background sync, which usually changes nothing at all, cost
   * dozens of parses and re-renders. Comparing the raw string first makes the
   * no-op case free.
   */
  const lastRawRef = useRef<string | null>(null);

  const broadcastUpdate = (newUser: User | null) => {
    if (newUser) {
      const raw = JSON.stringify(newUser);
      localStorage.setItem("davinci_user", raw);
      // Record it here too, or this instance re-parses its own write when the
      // event it just fired comes back around.
      lastRawRef.current = raw;
    } else {
      localStorage.removeItem("davinci_user");
      lastRawRef.current = null;
    }
    setUser(newUser);
    window.dispatchEvent(new Event("davinci_user_updated"));
  };

  useEffect(() => {
    const stored = localStorage.getItem("davinci_user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        lastRawRef.current = stored;
        setUser(parsedUser);

        // Background sync to ensure relations and points are fresh
        if (!isSyncing && parsedUser?.id) {
          isSyncing = true;
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          fetch(`${API_URL}/api/users/${parsedUser.id}`)
            .then(async res => {
              const data = await res.json();
              if (res.ok && data.success && localStorage.getItem("davinci_user")) {
                 broadcastUpdate(data.data);
              } else if (res.status === 404 || res.status === 401) {
                 broadcastUpdate(null);
              }
              isSyncing = false;
            })
            .catch(err => {
              console.error("Failed to sync user data", err);
              isSyncing = false;
            });
        }
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
    setIsLoaded(true);

    const handleSync = () => {
      const currentStored = localStorage.getItem("davinci_user");
      // Nothing actually changed for this instance — skip the parse and the
      // re-render entirely. This is the common case on every page load.
      if (currentStored === lastRawRef.current) return;
      if (currentStored) {
        try {
          const parsed = JSON.parse(currentStored);
          // Record only AFTER a successful parse. Marking it applied first
          // would mean corrupted JSON permanently poisons this instance: the
          // ref would hold a string we never applied, so if that same value
          // ever became valid again we'd skip it as "unchanged".
          lastRawRef.current = currentStored;
          setUser(parsed);
        } catch (e) {}
      } else {
        lastRawRef.current = null;
        setUser(null);
      }
    };

    // The storage handler must be a NAMED reference: it used to be registered
    // as an inline arrow and removed by `handleSync`, which is a different
    // function object — so removeEventListener matched nothing and every mount
    // left a listener behind for the life of the tab.
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "davinci_user") handleSync();
    };

    window.addEventListener("davinci_user_updated", handleSync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("davinci_user_updated", handleSync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  /** Registration is open — no invite code. The server stopped requiring one
   *  on 2026-08-19; sending a fourth argument here would just be ignored. */
  const signup = async (username: string, email: string, password: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();

      if (data.success) {
        setAuthToken(data.token || null);
        broadcastUpdate(data.data);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const login = async (identifier: string, password: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();

      if (data.success) {
        setAuthToken(data.token || null);
        broadcastUpdate(data.data);
        return { success: true, user: data.data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  /** The Discord door. No invite code, and no `requires_invite` branch — the
   *  server no longer answers 403 with it, so a caller checking that flag
   *  would be waiting for a reply that never comes. */
  const loginOrRegister = async (username: string, email: string, avatar?: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, avatar })
      });
      const data = await res.json();

      if (data.success) {
        setAuthToken(data.token || null);
        broadcastUpdate(data.data);
        return { success: true, user: data.data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const setDiscordUser = (userData: User) => {
    broadcastUpdate(userData);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        broadcastUpdate(result.data);
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const changeUsername = async (newUsername: string) => {
    if (!user) return { success: false, message: "You must be logged in." };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/username`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ username: newUsername }),
      });
      const result = await res.json();
      if (result.success) {
        broadcastUpdate(result.data);
        return { success: true, cost: result.cost as number, wasFree: result.wasFree as boolean };
      }
      return { success: false, message: result.message };
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const followUser = async (followingId: string) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const prev = user;

    // Optimistic: flip to "following" instantly so the button doesn't wait on
    // the (possibly cold) backend. Reconcile / roll back afterwards.
    const alreadyFollowing = (user.following || []).some((f: any) => f.followingId === followingId);
    if (!alreadyFollowing) {
      broadcastUpdate({ ...user, following: [...(user.following || []), { followingId }] });
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${followingId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId: prev.id })
      });
      const result = await res.json();

      if (!result.success) {
        broadcastUpdate(prev); // roll back the optimistic follow
        return result;
      }

      // Background refresh for fresh points/relations — non-blocking, keeps the
      // follow in place. Guard against a logged-out race.
      fetch(`${API_URL}/api/users/${prev.id}`)
        .then(r => r.json())
        .then(d => { if (d.success && localStorage.getItem("davinci_user")) broadcastUpdate(d.data); })
        .catch(() => {});

      return result;
    } catch (err) {
      broadcastUpdate(prev); // roll back on network error
      return { success: false, message: "Network error" };
    }
  };

  const unfollowUser = async (followingId: string) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const prev = user;

    // Optimistic: drop the follow instantly, reconcile / roll back afterwards.
    broadcastUpdate({ ...user, following: (user.following || []).filter((f: any) => f.followingId !== followingId) });

    try {
      const res = await fetch(`${API_URL}/api/users/${followingId}/follow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId: prev.id })
      });
      const result = await res.json();

      if (!result.success) {
        broadcastUpdate(prev); // roll back the optimistic unfollow
      }
      return result;
    } catch (err) {
      broadcastUpdate(prev); // roll back on network error
      return { success: false, message: "Network error" };
    }
  };

  const addXpForWatching = async (animeId?: number, episode?: number) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      // Send the anime + episode so the backend can reward only the FIRST watch
      // of each unique episode (deduped — no farming by rewatching).
      const res = await fetch(`${API_URL}/api/users/${user.id}/add-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, episode })
      });
      const result = await res.json();

      if (result.success && result.data?.arisePoints !== undefined) {
        // Reflect the server's authoritative totals (points + xp).
        const newUser = { ...user, arisePoints: result.data.arisePoints, xp: result.data.xp ?? user.xp };
        broadcastUpdate(newUser);
      }
      return result;
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const logout = () => {
    /**
     * Drop THIS account's cached reading progress before the session goes.
     *
     * Progress is cached per account (see lib/readingProgress), so the next
     * person to sign in on this browser could never have inherited it — but
     * logging out is the moment a shared machine changes hands, and leaving one
     * reader's places sitting in another's storage is not something to shrug
     * at. Ordering matters: this runs BEFORE broadcastUpdate(null) wipes
     * `davinci_user`, so the namespace can still be resolved if `user` state is
     * somehow stale in this instance.
     */
    clearAccountProgress(user?.id);
    setAuthToken(null);
    broadcastUpdate(null);
  };

  return { user, isLoaded, login, signup, loginOrRegister, setDiscordUser, updateProfile, changeUsername, followUser, unfollowUser, logout, addXpForWatching };
}
