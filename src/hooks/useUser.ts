"use client";

import { useState, useEffect } from "react";

export interface User {
  id: string;
  username: string;
  email: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("anipulse_user");
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
    
    // We try to register first. If the username/email exists, we'll pretend it's a "login" 
    // for this simple mock auth flow. In a real app, you'd have passwords.
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
        localStorage.setItem("anipulse_user", JSON.stringify(newUser));
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("anipulse_user");
  };

  return { user, isLoaded, loginOrRegister, logout };
}
