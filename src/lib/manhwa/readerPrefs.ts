// Manhwa Reader Preferences

export interface ManhwaReaderPrefs {
  theme: "dark" | "oled" | "light" | "comfort";
  pageGap: 0 | 4 | 8;
  brightness: number; // 0 to 100
  readingDirection: "ltr" | "rtl" | "vertical";
  
  // Toggles
  onePageView: boolean;
  plainView: boolean;
  lockRotation: boolean;
  autoNextChapter: boolean;
  fastRendering: boolean;
  canvasRendering: boolean;
  allowZoomInOut: boolean;
  
  tapToScroll: boolean;
  centerNavigation: boolean;
  darkControls: boolean;
  tapZones: boolean;
  keyboardShortcuts: boolean;
  showPageNumbers: boolean;
  
  sideChat: boolean;
  autoScroll: boolean;
}

export const defaultManhwaPrefs: ManhwaReaderPrefs = {
  theme: "dark",
  pageGap: 0,
  brightness: 100,
  readingDirection: "vertical",
  
  onePageView: false,
  plainView: false,
  lockRotation: false,
  autoNextChapter: true,
  fastRendering: true,
  canvasRendering: false,
  allowZoomInOut: true,
  
  tapToScroll: true,
  centerNavigation: true,
  darkControls: true,
  tapZones: false,
  keyboardShortcuts: true,
  showPageNumbers: false,
  
  sideChat: false,
  autoScroll: false,
};

export const MANHWA_THEMES = [
  { id: "dark", name: "Dark", bg: "#1e1e24", panel: "#18181c", text: "#f8f8f2", border: "#2a2a32", muted: "#888899" },
  { id: "oled", name: "OLED", bg: "#000000", panel: "#09090b", text: "#ffffff", border: "#1f1f22", muted: "#71717a" },
  { id: "light", name: "Light", bg: "#ffffff", panel: "#f4f4f5", text: "#09090b", border: "#e4e4e7", muted: "#a1a1aa" },
  { id: "comfort", name: "Comfort", bg: "#fdf6e3", panel: "#eee8d5", text: "#657b83", border: "#dfd9c6", muted: "#93a1a1" },
] as const;

export function themeById(id: string) {
  return MANHWA_THEMES.find((t) => t.id === id) || MANHWA_THEMES[1]; // default OLED
}

export const MANHWA_PREFS_KEY = "davinci_manhwa_prefs";

export function loadManhwaPrefs(): ManhwaReaderPrefs {
  if (typeof window === "undefined") return defaultManhwaPrefs;
  try {
    const saved = localStorage.getItem(MANHWA_PREFS_KEY);
    if (!saved) return defaultManhwaPrefs;
    return { ...defaultManhwaPrefs, ...JSON.parse(saved) };
  } catch {
    return defaultManhwaPrefs;
  }
}

export function saveManhwaPrefs(prefs: ManhwaReaderPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MANHWA_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
