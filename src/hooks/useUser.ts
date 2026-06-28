"use client";

import { useState, useEffect } from "react";

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("davinci_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const loginOrRegister = async (username: string, email: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email })
      });
      const data = await res.json();
      
      if (data.success) {
        const newUser = data.data;
        setUser(newUser);
        localStorage.setItem("davinci_user", JSON.stringify(newUser));
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
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
        const newUser = { ...user, ...data };
        setUser(newUser);
        localStorage.setItem("davinci_user", JSON.stringify(newUser));
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("davinci_user");
  };

  return { user, isLoaded, loginOrRegister, updateProfile, logout };
}
