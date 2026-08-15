/**
 * THE FEATURED NOVELS — the registry every crowned surface reads.
 *
 * The Must Read spotlight rotates through this list, and each novel's detail
 * page wears the matching aura, so adding or retiring a featured title is one
 * entry here and every surface follows. The two current pins deliberately wear
 * different skins: The Seventh Prince of Hell burns violet in the blackletter
 * of its own cover art, Eternal Malediction burns sunset amber-to-crimson in
 * the Cinzel of its.
 *
 * Palettes are FOUR rgba/hex strings, not free-form CSS, so every effect —
 * plumes, ring, embers, glow, gradient title, chips — composes from the same
 * few colours and a new theme cannot come out half-dressed. `font` must be a
 * CSS var registered in layout.tsx (fonts are self-hosted; next/font/google is
 * banned here — it broke the Vercel build platform-side once).
 */
export interface FeaturedPalette {
  /** Brightest tint — gradient top, ember cores, lit text. */
  bright: string;
  /** Mid accent — plume cores, ring sweep, chip text. */
  mid: string;
  /** Deep base — outer glow, gradient bottom. */
  deep: string;
  /** The tailwind-free hue used on badges/buttons, as "r,g,b". */
  rgb: string;
}

export interface FeaturedNovel {
  id: string;
  title: string;
  author: string;
  source: string;
  status: string;
  cover: string;
  genres: string[];
  hook: string;
  /** CSS font stack for the title — must be a self-hosted var. */
  font: string;
  palette: FeaturedPalette;
}

export const FEATURED_NOVELS: FeaturedNovel[] = [
  {
    id: "rr:142993",
    title: "The Seventh Prince of Hell",
    author: "Dejavuh",
    source: "RoyalRoad",
    status: "Ongoing",
    cover: "https://www.royalroadcdn.com/public/covers-large/142993-the-seventh-prince-of-hell.jpg",
    genres: ["Anti-Hero", "Action", "Fantasy", "Supernatural"],
    hook:
      "[System Alert: You have refused to kneel.] [The Heavenly Court rejects you.] [The Abyssal Court welcomes you.] In the era of After Dark, the world is ruled by the Awakened — and one prince refuses to bow.",
    font: "var(--font-pirata), 'Pirata One', serif",
    palette: {
      bright: "rgba(240,215,255,1)",
      mid: "rgba(168,85,247,1)",
      deep: "rgba(88,28,135,1)",
      rgb: "168,85,247",
    },
  },
  {
    id: "rr:141392",
    title: "Eternal Malediction",
    author: "L0ckyBoi",
    source: "RoyalRoad",
    status: "Ongoing",
    cover: "https://www.royalroadcdn.com/public/covers-large/eternal-malediction-aadad2jkahg.jpg",
    genres: ["Time Loop", "Progression", "Grimdark", "Psychological"],
    hook:
      "The greatest loser of all time. Roy Shyam, a cynical yet compassionate 17-year-old, is cursed to live the same defeat again and again — and to grow sharper every single time.",
    font: "var(--font-cinzel), 'Cinzel', serif",
    palette: {
      bright: "rgba(253,224,138,1)",
      mid: "rgba(245,158,11,1)",
      deep: "rgba(153,27,27,1)",
      rgb: "245,158,11",
    },
  },
];

export function featuredFor(id: string | null | undefined): FeaturedNovel | null {
  const raw = String(id || "");
  return FEATURED_NOVELS.find((n) => n.id === raw) || null;
}

export function isFeaturedNovel(id: string | null | undefined): boolean {
  return featuredFor(id) !== null;
}

/** Back-compat for the original single-pin import. */
export const FEATURED_NOVEL_ID = FEATURED_NOVELS[0].id;
