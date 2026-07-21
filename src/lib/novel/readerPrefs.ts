"use client";

import { useEffect, useState } from "react";

/**
 * Reader customization for the novel chapter reader — theme (background + text
 * colour), font family, size, line spacing, column width and justification.
 * Persisted as one JSON blob in localStorage so it follows the reader across
 * every chapter and novel. Migrates the old standalone `novel-font` key.
 */

export interface ReaderTheme {
  id: string;
  name: string;
  bg: string;      // page background
  panel: string;   // chrome (top bar, buttons, drawer, sheet)
  text: string;    // body text
  muted: string;   // secondary text / icons
  border: string;  // hairline borders
  dark: boolean;
}

export const READER_THEMES: ReaderTheme[] = [
  { id: "charcoal", name: "Charcoal", bg: "#100f0d", panel: "#1b1916", text: "#dad6cd", muted: "#9a948a", border: "rgba(255,255,255,0.09)", dark: true },
  { id: "midnight", name: "Midnight", bg: "#000000", panel: "#111111", text: "#c8c8c8", muted: "#7c7c7c", border: "rgba(255,255,255,0.08)", dark: true },
  { id: "dusk", name: "Dusk", bg: "#10141c", panel: "#1a2030", text: "#ccd3e0", muted: "#838ba0", border: "rgba(255,255,255,0.08)", dark: true },
  { id: "sepia", name: "Sepia", bg: "#f2e7cf", panel: "#e8dab9", text: "#574a34", muted: "#8a7a5c", border: "rgba(87,74,52,0.20)", dark: false },
  { id: "paper", name: "Paper", bg: "#fbfaf7", panel: "#efece5", text: "#262626", muted: "#6a6a6a", border: "rgba(0,0,0,0.10)", dark: false },
];

// ids "serif"/"sans"/"mono" are kept for back-compat with saved prefs; the
// display names are the real font names now that there's a whole shelf of them.
export const READER_FONTS = [
  { id: "serif", name: "Garamond", css: "var(--font-garamond), Georgia, 'Times New Roman', serif" },
  { id: "lora", name: "Lora", css: "var(--font-lora), Georgia, serif" },
  { id: "merriweather", name: "Merriweather", css: "var(--font-merriweather), Georgia, serif" },
  { id: "literata", name: "Literata", css: "var(--font-literata), Georgia, serif" },
  { id: "sans", name: "Geist Sans", css: "var(--font-geist-sans), system-ui, sans-serif" },
  { id: "lexend", name: "Lexend", css: "var(--font-lexend), system-ui, sans-serif" },
  { id: "mono", name: "Mono", css: "var(--font-geist-mono), ui-monospace, monospace" },
];

export const READER_SPACING = [
  { id: "tight", name: "Compact", value: 1.6 },
  { id: "normal", name: "Cozy", value: 1.9 },
  { id: "relaxed", name: "Airy", value: 2.25 },
];

export const READER_WIDTHS = [
  { id: "narrow", name: "Narrow", cls: "max-w-2xl" },
  { id: "normal", name: "Medium", cls: "max-w-3xl" },
  { id: "wide", name: "Wide", cls: "max-w-4xl" },
];

export const SIZE_MIN = 14;
export const SIZE_MAX = 30;

export interface ReaderPrefs {
  theme: string;
  font: string;
  size: number;
  spacing: string;
  width: string;
  justify: boolean;
}

export const READER_DEFAULTS: ReaderPrefs = {
  theme: "charcoal",
  font: "serif",
  size: 19,
  spacing: "normal",
  width: "normal",
  justify: false,
};

export const themeById = (id: string) => READER_THEMES.find((t) => t.id === id) || READER_THEMES[0];
export const fontById = (id: string) => READER_FONTS.find((f) => f.id === id) || READER_FONTS[0];
export const spacingById = (id: string) => READER_SPACING.find((s) => s.id === id) || READER_SPACING[1];
export const widthById = (id: string) => READER_WIDTHS.find((w) => w.id === id) || READER_WIDTHS[1];

const KEY = "novel-reader-prefs";

export function useNovelReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(READER_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let init: ReaderPrefs = { ...READER_DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        init = { ...init, ...JSON.parse(raw) };
      } else {
        // Migrate the old font-size-only key so long-time readers keep their size.
        const oldF = Number(localStorage.getItem("novel-font"));
        if (oldF >= SIZE_MIN && oldF <= SIZE_MAX) init.size = oldF;
      }
      // Guard against a stale saved id no longer in the option lists.
      init.size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(init.size) || READER_DEFAULTS.size));
    } catch {
      /* ignore */
    }
    setPrefs(init);
    setLoaded(true);
  }, []);

  const update = (patch: Partial<ReaderPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const reset = () => update(READER_DEFAULTS);

  return { prefs, update, reset, loaded };
}
