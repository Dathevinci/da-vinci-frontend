"use client";

import { useState, useEffect } from "react";

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bannerUrl?: string;
  bio?: string;
  arisePoints?: number;
  followers?: any[];
  following?: any[];
}

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
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        fetch(`${API_URL}/api/users/${parsedUser.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
               broadcastUpdate(data.data);
            }
          })
          .catch(err => console.error("Failed to sync user data", err));
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
        broadcastUpdate(data.data);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

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
        broadcastUpdate(data.data);
        return { success: true };
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
        headers: { "Content-Type": "application/json" },
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

  const followUser = async (followingId: string) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${API_URL}/api/users/${followingId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId: user.id })
      });
      const result = await res.json();
      
      if (result.success) {
        const userRes = await fetch(`${API_URL}/api/users/${user.id}`);
        const userData = await userRes.json();
        if (userData.success) {
          broadcastUpdate(userData.data);
        } else {
          const newUser = { ...user, following: [...(user.following || []), result.data] };
          broadcastUpdate(newUser);
        }
      }
      return result;
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const unfollowUser = async (followingId: string) => {
    if (!user) return { success: false };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${API_URL}/api/users/${followingId}/follow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId: user.id })
      });
      const result = await res.json();
      
      if (result.success) {
        const newUser = { ...user, following: (user.following || []).filter((f: any) => f.followingId !== followingId) };
        broadcastUpdate(newUser);
      }
      return result;
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const logout = () => {
    broadcastUpdate(null);
  };

  return { user, isLoaded, login, signup, loginOrRegister, setDiscordUser, updateProfile, followUser, unfollowUser, logout };
}
