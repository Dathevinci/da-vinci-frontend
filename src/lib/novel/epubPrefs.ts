"use client";

import { useEffect, useState } from "react";

/**
 * Settings for the EPUB reader, modelled on lnori.com's reader — the owner's
 * explicit reference for how reading a light novel should feel.
 *
 * Deliberately NOT the novel text reader's prefs. That reader styles scraped
 * chapter markup and offers a serif shelf for it; this one presents official
 * ebooks, and its controls mirror the reference: six named themes that each
 * carry a light and a dark variant behind one toggle, a typeface roster picked
 * for legibility (including accessibility faces), alignment, and bionic
 * emphasis.
 */

export interface EpubTheme {
  id: string;
  name: string;
  /** Swatch shown in the picker — the dark variant's background. */
  swatch: string;
  dark: { bg: string; text: string; muted: string };
  light: { bg: string; text: string; muted: string };
}

export const EPUB_THEMES: EpubTheme[] = [
  {
    id: "classic",
    name: "Classic",
    swatch: "#0a0a0a",
    dark: { bg: "#0a0a0a", text: "#e6e6e6", muted: "#8a8a8a" },
    light: { bg: "#ffffff", text: "#141414", muted: "#6b6b6b" },
  },
  {
    id: "vintage",
    name: "Vintage",
    swatch: "#3a3105",
    dark: { bg: "#1a1704", text: "#e8dcae", muted: "#a2966c" },
    light: { bg: "#f4ead2", text: "#4a3f22", muted: "#7d7052" },
  },
  {
    id: "lipstick",
    name: "Lipstick",
    swatch: "#3d0b1e",
    dark: { bg: "#1c0710", text: "#f0d4de", muted: "#a97e8f" },
    light: { bg: "#fdeef3", text: "#4a1327", muted: "#8d5468" },
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "#0b2f6b",
    dark: { bg: "#07142c", text: "#cfe0f5", muted: "#7d92ad" },
    light: { bg: "#eef4fd", text: "#122b4d", muted: "#5a7290" },
  },
  {
    id: "cyber",
    name: "Cyber",
    swatch: "#2c0d5e",
    dark: { bg: "#140628", text: "#ded0f5", muted: "#9b86bd" },
    light: { bg: "#f4eefd", text: "#2b1350", muted: "#6d5a90" },
  },
  {
    id: "nature",
    name: "Nature",
    swatch: "#0d3d22",
    dark: { bg: "#05190f", text: "#cfe8d8", muted: "#7ea48d" },
    light: { bg: "#eef8f1", text: "#0f2a1c", muted: "#547a63" },
  },
];

/**
 * The reference's roster, faces chosen for legibility rather than flavour:
 * Atkinson Hyperlegible was drawn by the Braille Institute for low vision,
 * OpenDyslexic weights letter bottoms so they are harder to flip, and Comic
 * Neue is the readable relative of the font many dyslexic readers genuinely
 * prefer. "Original" is a book-like Georgia stack — the extractor strips
 * publisher styling, so this is the closest thing to how the book would set
 * itself.
 */
export const EPUB_FONTS = [
  { id: "original", name: "Original", css: "Georgia, 'Times New Roman', serif" },
  { id: "ubuntu", name: "Ubuntu", css: "'Ubuntu', system-ui, sans-serif" },
  { id: "lexend", name: "Lexend", css: "'Lexend', system-ui, sans-serif" },
  { id: "atkinson", name: "Atkinson", css: "'Atkinson Hyperlegible', system-ui, sans-serif" },
  { id: "dyslexic", name: "Dyslexic", css: "'OpenDyslexic', 'Comic Neue', cursive" },
  { id: "comic", name: "Comic", css: "'Comic Neue', 'Comic Sans MS', cursive" },
];

export const EPUB_SIZE_MIN = 14;
export const EPUB_SIZE_MAX = 32;

export type EpubAlign = "left" | "center" | "right";

export interface EpubPrefs {
  theme: string;
  dark: boolean;
  font: string;
  size: number;
  align: EpubAlign;
  bionic: boolean;
}

export const EPUB_DEFAULTS: EpubPrefs = {
  theme: "classic",
  dark: true,
  font: "original",
  size: 19,
  align: "left",
  bionic: false,
};

export const epubThemeById = (id: string) =>
  EPUB_THEMES.find((t) => t.id === id) || EPUB_THEMES[0];
export const epubFontById = (id: string) =>
  EPUB_FONTS.find((f) => f.id === id) || EPUB_FONTS[0];

/** The resolved palette for the current theme + light/dark choice. */
export function epubPalette(prefs: EpubPrefs) {
  const t = epubThemeById(prefs.theme);
  return prefs.dark ? t.dark : t.light;
}

const KEY = "epub-reader-prefs";

export function useEpubPrefs() {
  const [prefs, setPrefs] = useState<EpubPrefs>(EPUB_DEFAULTS);

  // Restored in an effect, not an initializer: this component still
  // server-renders, and seeding state from localStorage during render makes
  // the server and client disagree about the first paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setPrefs((p) => ({
          ...p,
          ...saved,
          size: Math.min(EPUB_SIZE_MAX, Math.max(EPUB_SIZE_MIN, Number(saved.size) || p.size)),
        }));
      }
    } catch {
      /* private mode */
    }
  }, []);

  const update = (patch: Partial<EpubPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });

  return { prefs, update };
}
