"use client";

import { useState, useEffect } from "react";
import { authHeaders, setAuthToken } from "@/lib/authToken";

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bannerUrl?: string;
  bannerPosition?: number;
  bannerStyle?: string;
  bio?: string;
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

  const broadcastUpdate = (newUser: User | null) => {
    if (newUser) {
      localStorage.setItem("davinci_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("davinci_user");
    }
    setUser(newUser);
    window.dispatchEvent(new Event("davinci_user_updated"));
  };

  useEffect(() => {
    const stored = localStorage.getItem("davinci_user");
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
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
      if (currentStored) {
        try {
          setUser(JSON.parse(currentStored));
        } catch (e) {}
      } else {
        setUser(null);
      }
    };

    window.addEventListener("davinci_user_updated", handleSync);
    window.addEventListener("storage", (e) => {
      if (e.key === "davinci_user") handleSync();
    });

    return () => {
      window.removeEventListener("davinci_user_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const signup = async (username: string, email: string, password: string, inviteCode: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, inviteCode })
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

  const loginOrRegister = async (username: string, email: string, avatar?: string, inviteCode?: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, avatar, inviteCode })
      });
      const data = await res.json();

      if (data.success) {
        setAuthToken(data.token || null);
        broadcastUpdate(data.data);
        return { success: true, user: data.data };
      } else {
        if (data.requires_invite) {
           return { success: false, requires_invite: true, message: data.message };
        }
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
    setAuthToken(null);
    broadcastUpdate(null);
  };

  return { user, isLoaded, login, signup, loginOrRegister, setDiscordUser, updateProfile, changeUsername, followUser, unfollowUser, logout, addXpForWatching };
}
