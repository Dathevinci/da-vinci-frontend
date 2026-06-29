"use client";

import { useState, useEffect } from "react";

export interface Preferences {
  autoplayTrailers: boolean;
  reducedMotion: boolean;
  blurSensitiveContent: boolean;
  dataSaver: boolean;
}

const defaultPreferences: Preferences = {
  autoplayTrailers: true,
  reducedMotion: false,
  blurSensitiveContent: true,
  dataSaver: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("davinci_preferences");
    if (stored) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
      } catch (e) {
        console.error("Failed to parse preferences", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const updatePreference = (key: keyof Preferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    localStorage.setItem("davinci_preferences", JSON.stringify(updated));
    window.dispatchEvent(new Event("davinci_preferences_updated"));
  };

  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem("davinci_preferences");
      if (stored) {
        try {
          setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
        } catch (e) {}
      }
    };
    window.addEventListener("davinci_preferences_updated", handleSync);
    return () => window.removeEventListener("davinci_preferences_updated", handleSync);
  }, []);

  return { preferences, updatePreference, isLoaded };
}
