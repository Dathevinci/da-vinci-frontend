"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { useUser } from "@/hooks/useUser";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Load from local storage
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme class to HTML root
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const { preferences } = usePreferences();
  const { user } = useUser();

  useEffect(() => {
    if (preferences.reducedMotion) {
      document.body.classList.add("reduced-motion");
    } else {
      document.body.classList.remove("reduced-motion");
    }
  }, [preferences.reducedMotion]);

  useEffect(() => {
    // Data Saver → a body flag any component can read via CSS, plus it gates the
    // heavy autoplay trailer (see AnimeBackgroundTrailer). Universal across modes.
    document.body.classList.toggle("data-saver", preferences.dataSaver);
  }, [preferences.dataSaver]);

  useEffect(() => {
    // Clear any existing theme classes
    document.body.classList.remove("theme-neon", "theme-crimson");
    
    // Add the active theme class if one is selected
    if (user?.activeTheme === "theme_neon") {
      document.body.classList.add("theme-neon");
    } else if (user?.activeTheme === "theme_crimson") {
      document.body.classList.add("theme-crimson");
    }
  }, [user?.activeTheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
