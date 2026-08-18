"use client";

import { useId, type JSX } from "react";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * THE STAMP SEAL — the golden "<NAME> RECOMMENDED" wax seal that sits on a
 * cover when a curator has stamped that title.
 *
 * Everything here is DRAWN, not imported: the serrated rim, the wreath, the
 * metal, the glyph are all path math + gradients. There is no image asset, no
 * emoji, no font-icon anywhere in this file, per house rule.
 *
 * PERFORMANCE CONTRACT (the reason this file is shaped the way it is):
 * this seal renders on covers INSIDE GRIDS — a page can hold 30+ of them.
 * Therefore the default path has
 *   - no <canvas>, no filter/feGaussianBlur/drop-shadow, no shadowBlur,
 *   - no framer-motion, no infinite CSS loops, no backdrop-filter,
 *   - no per-render trigonometry: every path string that does not depend on
 *     the props (rim serration, text circles, both bevel arcs, all three
 *     wreaths, the crest star) is computed ONCE at module load and reused by
 *     every instance,
 *   - no usePreferences() subscription. That hook mounts an effect + a window
 *     listener per call, so the static seal never calls it at all: StampSeal
 *     routes to a plain component when `animated` is false and only the
 *     opt-in animated variant pays for the preference subscription.
 * Depth is faked with gradients and hairline arcs instead of shadows, which
 * costs nothing to composite.
 *
 * The optional sheen (`animated`) is for single-instance surfaces only —
 * a profile hero, a rank-up modal — never a grid. It is gated on Performance
 * Mode (usePreferences().reducedMotion) and on the OS prefers-reduced-motion.
 */

export type StampGrade = "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

type SealSize = "sm" | "md" | "lg";
type SealRank = 1 | 2 | 3;

/* ------------------------------------------------------------------ *
 * Geometry — one 100x100 viewBox, every size is just a CSS px scale.
 * ------------------------------------------------------------------ */

const CX = 50;
const CY = 50;

const PX: Record<SealSize, number> = { sm: 56, md: 88, lg: 132 };

/**
 * Username budget per size — the legibility lever. The name arc is a fixed
 * slice of the ring, so every extra character costs every other character its
 * size. At sm the whole seal is 56px wide and 9 characters is the point where
 * the type stops shrinking and starts disappearing; past that we cut with an
 * ellipsis rather than let a long name grind the whole legend into noise.
 */
const NAME_MAX: Record<SealSize, number> = { sm: 9, md: 13, lg: 16 };

const TEETH = 40;
const R_TIP = 46;
const R_VALLEY = 42.4;
const R_BODY = 43;
const R_BAND_OUT = 41.2;
const R_BAND_IN = 31.2;

/**
 * THE RING IS TWO ARCS, NOT ONE — and that is a deliberate, tested choice.
 *
 * The obvious build is a single textPath carrying "<NAME> · RECOMMENDED" all
 * the way around the circle. Rendered, it fails: 20-odd characters spread over
 * 360° means the username lands on the lower-left of the ring, rotated past
 * 90°, and you have to tilt your head to read the one word that matters. That
 * is also why every real struck seal splits the legend — name across the top,
 * motto across the bottom, ornament at the sides.
 *
 * So: NAME rides a clockwise arc whose midpoint is 12 o'clock (glyphs grow
 * outward), RECOMMENDED rides a counter-clockwise arc whose midpoint is 6
 * o'clock (glyphs grow inward, so it is upright too), and the "·" separators
 * sit at 3 and 9 o'clock where the two legends meet. The ring still reads
 * "<NAME> · RECOMMENDED"; every glyph is now within 85° of upright, and each
 * legend gets its own arc so the type is ~2x the size a single ring allowed.
 */
const R_TEXT_TOP = 31.6; // name baseline — glyphs grow OUTWARD toward the rim
const R_TEXT_BOT = 40.6; // motto baseline — glyphs grow INWARD toward the field

const NAME_ARC = 2 * Math.PI * R_TEXT_TOP * (170 / 360);
const MOTTO = "RECOMMENDED";
const MOTTO_ARC = 2 * Math.PI * R_TEXT_BOT * (150 / 360);
const R_DOT = (R_BAND_OUT + R_BAND_IN) / 2;

/**
 * ADVANCE ESTIMATION IS PER-SCRIPT, NOT ONE AVERAGE.
 *
 * A single constant here used to be 0.68 — the average advance of Cinzel CAPS,
 * i.e. a Latin number. That is fine radially (a mis-estimate only nudges the
 * tracking) but NOT angularly: text on a path does not compress, it just eats
 * more arc. Hangul/Kana/CJK are full-width by design (~1em per glyph), so a
 * 9-syllable Korean name estimated at 0.68 asked for ~236° of a 170° arc — the
 * outer glyphs swung past sideways, ran over both "·" separators and collided
 * with the motto. Exactly the failure the two-arc legend above exists to stop.
 *
 * So each codepoint contributes its own script's advance, and fitArcText below
 * turns the estimate into a HARD budget rather than a hint.
 *
 * The numbers are MEASURED, not guessed — getComputedTextLength() at weight
 * 700 over a spread of codepoints per range, across the Roman faces this stack
 * can land on (Georgia / Times / Palatino / Book Antiqua / Cambria):
 *   Hangul, Jamo, Kana, CJK and fullwidth are all exactly 1.000, ext-B 1.020;
 *   emoji top out at 1.373 (U+2614, U+2B50, U+1F525 all hit it); VS16, marks and
 *   ZWJ are exactly 0.000; the ellipsis reaches 1.000 — it is three dots, NOT
 *   a Latin-average glyph, which is the trap of charging it 0.68; and among
 *   caps only W (1.126), M (1.023) and H (0.913) clear 0.85, the rest sitting
 *   at or under the 0.68 average this file was tuned around.
 * Each constant sits just above the measured ceiling for what it covers, so
 * the estimate is an upper bound rather than a hopeful mean.
 */
const ADV_LATIN = 0.68; // Cinzel caps average — the tuned look depends on it
const ADV_LATIN_WIDE = 1.15; // W/M/H only: the three caps the average underbids
const ADV_ELLIPSIS = 1.0; // "…" measured at 1.000 in the widest face
const ADV_WIDE = 1.05; // East Asian full-width: 1.000 measured, 1.020 for ext-B
const ADV_EMOJI = 1.4; // colour glyphs come from a fallback face: 1.373 measured
const ADV_MARK = 0; // combining marks / ZWJ / variation selectors: no advance

/**
 * Estimated advance of one codepoint, in em. Ranges are coarse on purpose —
 * this is a fitting budget, not shaping. Erring WIDE is the safe direction:
 * an over-estimate only makes the type a little smaller than it had to be,
 * while an under-estimate is the overflow bug this replaces.
 */
function advanceOf(cp: number): number {
  // Zero-width: combining diacritics, enclosing marks, variation selectors, ZWJ.
  if (
    cp === 0x200d ||
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f)
  ) {
    return ADV_MARK;
  }
  // "…" is three dots wide, not one Latin glyph. Charged as an average it
  // under-bids by ~0.3em on exactly the strings truncateToEm just cut to fit.
  if (cp === 0x2026) return ADV_ELLIPSIS;
  // The only caps the Latin average under-bids. Everything reaching an arc is
  // upper-cased by sealName, so the lowercase forms cannot occur here.
  if (cp === 0x57 || cp === 0x4d || cp === 0x48) return ADV_LATIN_WIDE; // W M H
  // Symbols & pictographs (checked before the CJK block so ★/☆ land here).
  if (
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    (cp >= 0x1f000 && cp <= 0x1faff)
  ) {
    return ADV_EMOJI;
  }
  // East Asian Wide / Fullwidth: Jamo, Kana, Bopomofo, CJK (incl. ext A/B+),
  // Yi, Hangul syllables, compatibility ideographs and the fullwidth forms.
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xa960 && cp <= 0xa97f) ||
    (cp >= 0xac00 && cp <= 0xd7ff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return ADV_WIDE;
  }
  return ADV_LATIN;
}

/**
 * Total estimated advance (in em) and the count of glyphs that actually take
 * space. Iterating with for...of walks CODEPOINTS, so an astral character is
 * measured once instead of twice as two broken surrogate halves.
 */
function measureEm(text: string): { em: number; glyphs: number } {
  let em = 0;
  let glyphs = 0;
  for (const ch of text) {
    const a = advanceOf(ch.codePointAt(0) as number);
    em += a;
    if (a > 0) glyphs += 1;
  }
  return { em, glyphs };
}
// Cinzel is the site's inscriptional Roman face (loaded globally in layout.tsx)
// — the closest thing we have to the lettering actually struck into a seal.
const SEAL_FONT = "var(--font-cinzel), Georgia, 'Times New Roman', serif";
const FS_MIN = 7;
const FS_MAX = 12.6; // cap height 12.6*0.7 = 8.8 -> stays inside the 10-unit band

const TILT = -12;
const RANK_SCALE = 0.84; // medallion yields room to the wreath, footprint fixed

const R_STEM = 40.9;
const LEAF_TILT = 24;

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

function polar(r: number, deg: number): [number, number] {
  const a = rad(deg);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

/** Serrated wax-seal rim: 40 teeth, alternating tip/valley radius. */
function buildSerration(): string {
  const n = TEETH * 2;
  let d = "";
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(i % 2 === 0 ? R_TIP : R_VALLEY, (i * 360) / n);
    d += `${i === 0 ? "M" : "L"}${r2(x)} ${r2(y)}`;
  }
  return `${d}Z`;
}
const SERRATION_D = buildSerration();

/**
 * Name path: CLOCKWISE from 6 o'clock, as two half arcs so the exact midpoint
 * of the path is 12 o'clock. startOffset="50%" + text-anchor="middle" then
 * centres the name on top of the seal, upright, radiating outward.
 */
const PATH_TOP =
  `M${CX} ${CY + R_TEXT_TOP}` +
  `A${R_TEXT_TOP} ${R_TEXT_TOP} 0 0 1 ${CX} ${CY - R_TEXT_TOP}` +
  `A${R_TEXT_TOP} ${R_TEXT_TOP} 0 0 1 ${CX} ${CY + R_TEXT_TOP}`;

/**
 * Motto path: COUNTER-CLOCKWISE from 12 o'clock, midpoint at 6 o'clock. On a
 * counter-clockwise path the glyphs' "up" points at the circle centre, which
 * is exactly what makes bottom-of-the-ring text read upright instead of
 * hanging upside down.
 */
const PATH_BOT =
  `M${CX} ${CY - R_TEXT_BOT}` +
  `A${R_TEXT_BOT} ${R_TEXT_BOT} 0 0 0 ${CX} ${CY + R_TEXT_BOT}` +
  `A${R_TEXT_BOT} ${R_TEXT_BOT} 0 0 0 ${CX} ${CY - R_TEXT_BOT}`;

/** Sampled arc — cheaper to reason about than sweep flags, identical on screen. */
function arcPolyline(r: number, from: number, to: number): string {
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 6));
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const [x, y] = polar(r, from + ((to - from) * i) / steps);
    d += `${i === 0 ? "M" : "L"}${r2(x)} ${r2(y)}`;
  }
  return d;
}

/**
 * Bevel arcs: a lit sweep top-left and a shaded sweep bottom-right, faking the
 * emboss a drop-shadow filter would have cost us a repaint for. Their radius
 * and angles are module constants, so — like the serration, the text circles
 * and the wreaths — they are built ONCE here rather than re-sampled (25 steps,
 * 52 trig calls each) on every render of every seal in a 30-seal grid.
 */
const R_BEVEL = R_BAND_OUT - 0.3;
const BEVEL_LIT_D = arcPolyline(R_BEVEL, 60, 210);
const BEVEL_SHADE_D = arcPolyline(R_BEVEL, -120, 30);

/** Laurel leaf, base at the origin, tip at +x. Scaled/rotated per placement. */
const LEAF_D = "M0 0Q4.2-2.6 9 0Q4.2 2.6 0 0";

type Leaf = { x: number; y: number; rot: number; s: number };
type Wreath = { leaves: Leaf[]; stem: string; crest: "star" | "bead" | null };

/**
 * ONE branch (the left one). The right branch is the same nodes rendered
 * through a mirror transform, so the wreath costs half the math and is
 * perfectly symmetric by construction.
 */
function buildWreath(rank: SealRank): Wreath {
  const count = rank === 1 ? 9 : rank === 2 ? 7 : 5;
  const from = 250;
  const to = rank === 1 ? 108 : rank === 2 ? 126 : 156;
  const leaves: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const deg = from + (to - from) * t;
    const [x, y] = polar(R_STEM, deg);
    const a = rad(deg);
    // Travel direction along the branch (bottom -> top), then splayed outward.
    const rot = (Math.atan2(Math.cos(a), Math.sin(a)) * 180) / Math.PI - LEAF_TILT;
    leaves.push({ x: r2(x), y: r2(y), rot: r2(rot), s: r2(1 - 0.4 * t) });
  }
  return {
    leaves,
    stem: arcPolyline(R_STEM - 0.5, from, to),
    crest: rank === 1 ? "star" : rank === 2 ? "bead" : null,
  };
}
const WREATHS: Record<SealRank, Wreath> = {
  1: buildWreath(1),
  2: buildWreath(2),
  3: buildWreath(3),
};

/** Procedural 5-point star for the rank-1 crest. */
function buildStar(cx: number, cy: number, outer: number, inner: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rad(90 + i * 36);
    d += `${i === 0 ? "M" : "L"}${r2(cx + r * Math.cos(a))} ${r2(cy - r * Math.sin(a))}`;
  }
  return `${d}Z`;
}
const CREST_STAR_D = buildStar(CX, CY - 44.2, 5.1, 2.1);
// The tie sits ON the stem radius, where the two branches actually meet —
// a bead floating out at the leaf tips reads as a stray speck instead.
const TIE_Y = CY + R_STEM - 0.5;

/* ------------------------------------------------------------------ *
 * Tier palettes — grade must be readable at a glance, from the metal
 * alone, before you can read the glyph.
 * ------------------------------------------------------------------ */

type Tier = "bronze" | "silver" | "gold" | "prism";

const TIER_OF: Record<StampGrade, Tier> = {
  D: "bronze",
  C: "bronze",
  B: "silver",
  A: "silver",
  S: "gold",
  SS: "gold",
  SSS: "prism",
};

type Palette = {
  rim: string[];
  band: string[];
  ink: string;
  field: [string, string];
  glyph: string[];
  shade: string;
  edge: string;
  gloss: string;
};

const PALETTES: Record<Tier, Palette> = {
  // Aged bronze — D / C
  bronze: {
    rim: ["#d8a86f", "#9c6733", "#5d3818"],
    band: ["#f2d7b2", "#c68d54", "#8a5a2b", "#dcb283"],
    ink: "#3a2110",
    field: ["#54341a", "#22130a"],
    glyph: ["#f8e2c4", "#d6a76b", "#a8733c"],
    shade: "#180d05",
    edge: "#2a1809",
    gloss: "#fff0d8",
  },
  // Struck silver — B / A
  silver: {
    rim: ["#f2f6fb", "#a8b4c4", "#5f6a78"],
    band: ["#fdfeff", "#ced8e4", "#8c99aa", "#e3eaf2"],
    ink: "#27303d",
    field: ["#454f5d", "#171c24"],
    glyph: ["#ffffff", "#d8e1ec", "#98a6b8"],
    shade: "#0d1116",
    edge: "#1b212a",
    gloss: "#ffffff",
  },
  // Foil gold — S / SS
  gold: {
    rim: ["#ffeab0", "#e3ad35", "#8a5f10"],
    band: ["#fff5d0", "#f2c657", "#b9860c", "#f7d97f"],
    ink: "#4a2f05",
    field: ["#553c09", "#221703"],
    glyph: ["#fff8dc", "#f5d16d", "#c99320"],
    shade: "#150d02",
    edge: "#2c1d03",
    gloss: "#fffbe8",
  },
  // Iridescent — SSS. A multi-stop prismatic sweep, still perfectly static.
  prism: {
    rim: ["#ffd3f0", "#c6b4ff", "#9ae4ff", "#ffe6a8"],
    band: ["#ffd9f2", "#ffeeb0", "#b5f6d4", "#a9e2ff", "#c9b6ff", "#ffd0ec"],
    ink: "#2b1544",
    field: ["#3a2160", "#120a20"],
    glyph: ["#ffe3f6", "#b6f0ff", "#d8c4ff", "#ffe9b0"],
    shade: "#0c0518",
    edge: "#1d1030",
    gloss: "#ffffff",
  },
};

const RANK_METAL: Record<SealRank, { grad: string[]; stem: string }> = {
  1: { grad: ["#fff0bd", "#e8b53f", "#9a6a14"], stem: "#a9761c" },
  2: { grad: ["#ffffff", "#ccd6e2", "#7e8a99"], stem: "#8b97a6" },
  3: { grad: ["#f4cda2", "#c07f42", "#7a4a1e"], stem: "#8a5525" },
};

/* ------------------------------------------------------------------ *
 * Text fitting
 * ------------------------------------------------------------------ */

/**
 * The per-size CHARACTER cap. This is the cosmetic cut only — it keeps a long
 * Latin name from grinding the legend down. It is NOT the overflow guard: a
 * character count says nothing about how much arc those characters occupy, so
 * fitArcText's em budget is what actually bounds the ring.
 *
 * Sliced by codepoint, not by UTF-16 unit, so cutting never lands inside a
 * surrogate pair and leaves half a glyph behind.
 */
function sealName(username: string, size: SealSize): string {
  const clean = String(username ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!clean) return "";
  const max = NAME_MAX[size] ?? NAME_MAX.sm;
  const cps = Array.from(clean);
  return cps.length > max ? `${cps.slice(0, max - 1).join("")}…` : clean;
}

/** Round DOWN to 2dp. Fitting must never round a value UP past its budget. */
const r2d = (n: number) => Math.floor(n * 100) / 100;

/**
 * Drop codepoints off the end until the remainder (plus an ellipsis) fits
 * `emBudget`. Splitting via for...of keeps surrogate pairs intact, so we can
 * never cut an astral glyph in half and emit a lone replacement box.
 */
function truncateToEm(text: string, emBudget: number): string {
  if (measureEm(text).em <= emBudget) return text;
  const kept: string[] = [];
  let acc = 0;
  for (const ch of text) {
    const a = advanceOf(ch.codePointAt(0) as number);
    // Reserve the ellipsis' own (wide) advance before accepting a glyph.
    if (acc + a + ADV_ELLIPSIS > emBudget) break;
    acc += a;
    kept.push(ch);
  }
  if (kept.length) return `${kept.join("")}…`;
  // Not even one glyph plus an ellipsis fits: a bare "…" tells the reader
  // nothing, so keep the single leading glyph if it fits on its own.
  const first = Array.from(text)[0];
  return first && advanceOf(first.codePointAt(0) as number) <= emBudget ? first : "";
}

type ArcFit = { text: string; fs: number; track: number };

/**
 * Fit `text` into `arc` (in user units of ring length) and return what to
 * actually draw. The arc budget is HARD — the returned metrics satisfy
 *
 *     em * fs  +  track * glyphs  <=  arc
 *
 * by construction, so the legend can never spill into the neighbouring arc no
 * matter what script the username is written in. Three levers, in order:
 *
 *  1. TRUNCATE — if the text cannot reach FS_MIN inside the arc it is cut with
 *     an ellipsis. Shrinking past FS_MIN is not a fit, it is an unreadable
 *     smudge, and the old code's Math.max(FS_MIN, ...) silently overflowed.
 *  2. CLAMP the size to arc/em (and to FS_MAX, which keeps caps inside the
 *     10-unit band). This is what makes the fit provable.
 *  3. TRACKING spends only the leftover, capped, so a 2-letter name spaces out
 *     like a struck seal instead of stretching into a smear.
 *
 * Tracking is budgeted over `glyphs`, not `glyphs - 1`, because CSS/SVG
 * letter-spacing is applied AFTER every glyph including the last one.
 */
function fitArcText(text: string, arc: number, maxTrack: number): ArcFit {
  const fitted = truncateToEm(text, arc / FS_MIN);
  const { em, glyphs } = measureEm(fitted);
  if (!glyphs || em <= 0) return { text: "", fs: FS_MIN, track: 0 };
  // em <= arc/FS_MIN after truncation, so arc/em >= FS_MIN: no lower clamp is
  // needed, and none may be added — a lower clamp is precisely the overflow.
  const fs = r2d(Math.min(FS_MAX, arc / em));
  const slack = Math.max(0, arc - em * fs);
  const track = r2d(Math.min(fs * maxTrack, slack / glyphs));
  return { text: fitted, fs, track };
}

// The motto never changes, so its metrics are resolved once at module load.
const MOTTO_FIT = fitArcText(MOTTO, MOTTO_ARC, 0.18);

/** Grade glyphs are 1–3 chars; each width gets its own size so "SSS" still fits the field. */
function glyphSize(grade: string): number {
  if (grade.length >= 3) return 22;
  if (grade.length === 2) return 30;
  return 40;
}

/* ------------------------------------------------------------------ *
 * Art
 * ------------------------------------------------------------------ */

function gradientStops(colors: string[]) {
  const last = colors.length - 1;
  return colors.map((c, i) => (
    <stop key={i} offset={`${last === 0 ? 0 : (i / last) * 100}%`} stopColor={c} />
  ));
}

type ArtProps = {
  username: string;
  grade: StampGrade;
  size: SealSize;
  rank: SealRank | null;
  sheen: boolean;
  fluid?: boolean;
  className?: string;
};

function SealArt({ username, grade, size, rank, sheen, fluid = false, className }: ArtProps) {
  // Sanitised so the fragment is always a legal XML id / CSS ident, whatever
  // React's useId format happens to be in this version.
  const uid = `dvst${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const pal = PALETTES[TIER_OF[grade] ?? "bronze"];
  const px = PX[size] ?? PX.sm;

  // Short names get generous tracking (0.3em cap) so "K" or "SUNLE" still
  // arcs across the crown of the seal instead of huddling at 12 o'clock.
  // Draw fitArcText's OWN text, not the input: it is allowed to cut further
  // when a wide script cannot reach FS_MIN inside the arc, and drawing the
  // untrimmed string would put the overflow straight back.
  const nameFit = fitArcText(sealName(username, size), NAME_ARC, 0.3);
  const name = nameFit.text;

  const gfs = glyphSize(grade);
  const gy = CY + gfs * 0.355; // cap-height centring, no dominant-baseline quirks
  const wreath = rank ? WREATHS[rank] : null;
  const metal = rank ? RANK_METAL[rank] : null;

  const sheenCss = sheen
    ? `.${uid}s{animation:${uid}k 4.2s cubic-bezier(.4,0,.2,1) infinite}` +
      `@keyframes ${uid}k{0%,58%{transform:translateX(-26px)}100%{transform:translateX(122px)}}` +
      `@media (prefers-reduced-motion:reduce){.${uid}s{animation:none;opacity:0}}`
    : "";

  return (
    <span
      className={`inline-block align-middle pointer-events-none${className ? ` ${className}` : ""}`}
      /**
       * FLUID lets the caller size the seal from CSS instead of the px table.
       * A cover in a 132px carousel gave the fixed 56px seal 42% of the art
       * and about two pixels of clearance from the Official badge, while the
       * same component on a full-width poster looked undersized. Fluid keeps
       * ONE seal component: the size prop still chooses the type budget (how
       * much of the name survives), the container chooses the pixels.
       */
      style={fluid ? { width: "100%", aspectRatio: "1 / 1", lineHeight: 0 } : { width: px, height: px, lineHeight: 0 }}
    >
      <svg
        viewBox="0 0 100 100"
        width={fluid ? "100%" : px}
        height={fluid ? "100%" : px}
        role="img"
        aria-label={
          `${sealName(username, "lg") || "Curator"} · ${MOTTO}` +
          `, stamp grade ${grade}${rank ? `, weekly rank ${rank}` : ""}`
        }
        focusable="false"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`${uid}r`} gradientUnits="userSpaceOnUse" x1="14" y1="10" x2="86" y2="92">
            {gradientStops(pal.rim)}
          </linearGradient>
          <linearGradient id={`${uid}b`} gradientUnits="userSpaceOnUse" x1="12" y1="8" x2="88" y2="94">
            {gradientStops(pal.band)}
          </linearGradient>
          <linearGradient id={`${uid}g`} gradientUnits="userSpaceOnUse" x1="30" y1="28" x2="70" y2="74">
            {gradientStops(pal.glyph)}
          </linearGradient>
          <radialGradient id={`${uid}f`} gradientUnits="userSpaceOnUse" cx="39" cy="35" r="46">
            <stop offset="0%" stopColor={pal.field[0]} />
            <stop offset="100%" stopColor={pal.field[1]} />
          </radialGradient>
          {metal && (
            <linearGradient id={`${uid}w`} gradientUnits="userSpaceOnUse" x1="18" y1="12" x2="82" y2="90">
              {gradientStops(metal.grad)}
            </linearGradient>
          )}
          {sheen && (
            <>
              <linearGradient id={`${uid}h`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              {/* clipped at the tooth tips, not the body, so the light runs
                  off the serration instead of stopping short of it */}
              <clipPath id={`${uid}c`}>
                <circle cx={CX} cy={CY} r={R_TIP} />
              </clipPath>
            </>
          )}
        </defs>

        {sheen && <style dangerouslySetInnerHTML={{ __html: sheenCss }} />}

        <g transform={`rotate(${TILT} ${CX} ${CY})`}>
          {/* --- prestige wreath: previous week's top 3 --------------- */}
          {wreath && metal && (
            <g>
              {[false, true].map((mirrored) => (
                <g
                  key={mirrored ? "r" : "l"}
                  transform={mirrored ? "translate(100 0) scale(-1 1)" : undefined}
                >
                  <path
                    d={wreath.stem}
                    fill="none"
                    stroke={metal.stem}
                    strokeWidth="1.15"
                    strokeLinecap="round"
                  />
                  {wreath.leaves.map((lf, i) => (
                    <path
                      key={i}
                      d={LEAF_D}
                      fill={`url(#${uid}w)`}
                      stroke={metal.stem}
                      strokeWidth="0.35"
                      transform={`translate(${lf.x} ${lf.y}) rotate(${lf.rot}) scale(${lf.s})`}
                    />
                  ))}
                </g>
              ))}
              {wreath.crest === "star" && (
                <path d={CREST_STAR_D} fill={`url(#${uid}w)`} stroke={metal.stem} strokeWidth="0.4" />
              )}
              {wreath.crest === "bead" && (
                <circle cx={CX} cy={CY - R_STEM - 0.7} r="2.2" fill={`url(#${uid}w)`} stroke={metal.stem} strokeWidth="0.4" />
              )}
              <circle cx={CX} cy={TIE_Y} r="2.2" fill={`url(#${uid}w)`} stroke={metal.stem} strokeWidth="0.4" />
            </g>
          )}

          {/* --- the medallion ---------------------------------------- */}
          <g
            transform={
              rank ? `translate(${CX} ${CY}) scale(${RANK_SCALE}) translate(${-CX} ${-CY})` : undefined
            }
          >
            {/* serrated wax edge */}
            <path d={SERRATION_D} fill={`url(#${uid}r)`} stroke={pal.edge} strokeWidth="0.5" strokeLinejoin="round" />
            {/* body */}
            <circle cx={CX} cy={CY} r={R_BODY} fill={`url(#${uid}r)`} />
            {/* struck ring band, drawn as one stroked circle */}
            <circle
              cx={CX}
              cy={CY}
              r={(R_BAND_OUT + R_BAND_IN) / 2}
              fill="none"
              stroke={`url(#${uid}b)`}
              strokeWidth={R_BAND_OUT - R_BAND_IN}
            />
            {/* bevel: lit top-left, shaded bottom-right (both hoisted above) */}
            <path
              d={BEVEL_LIT_D}
              fill="none"
              stroke={pal.gloss}
              strokeOpacity="0.5"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <path
              d={BEVEL_SHADE_D}
              fill="none"
              stroke={pal.edge}
              strokeOpacity="0.45"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <circle cx={CX} cy={CY} r={R_BAND_OUT} fill="none" stroke={pal.edge} strokeOpacity="0.55" strokeWidth="0.5" />

            {/* the curved legend: name over the crown, motto under the foot,
                "·" where the two meet */}
            <path id={`${uid}t`} d={PATH_TOP} fill="none" />
            <path id={`${uid}m`} d={PATH_BOT} fill="none" />
            {name && (
              <text
                fill={pal.ink}
                fontSize={nameFit.fs}
                fontWeight={700}
                letterSpacing={nameFit.track}
                fontFamily={SEAL_FONT}
              >
                <textPath href={`#${uid}t`} startOffset="50%" textAnchor="middle">
                  {name}
                </textPath>
              </text>
            )}
            <text
              fill={pal.ink}
              fontSize={MOTTO_FIT.fs}
              fontWeight={700}
              letterSpacing={MOTTO_FIT.track}
              fontFamily={SEAL_FONT}
            >
              {/* MOTTO_FIT.text, not MOTTO — the fitter is the single source
                  of what gets drawn on an arc, for both legends alike. It is
                  identical to MOTTO today; it stays honest if MOTTO grows. */}
              <textPath href={`#${uid}m`} startOffset="50%" textAnchor="middle">
                {MOTTO_FIT.text}
              </textPath>
            </text>
            {name && (
              <>
                <circle cx={CX + R_DOT} cy={CY} r="1.6" fill={pal.ink} />
                <circle cx={CX - R_DOT} cy={CY} r="1.6" fill={pal.ink} />
              </>
            )}

            {/* inner field */}
            <circle cx={CX} cy={CY} r={R_BAND_IN} fill={`url(#${uid}f)`} />
            <circle cx={CX} cy={CY} r={R_BAND_IN} fill="none" stroke={pal.edge} strokeWidth="0.8" />
            <circle
              cx={CX}
              cy={CY}
              r={R_BAND_IN - 2.6}
              fill="none"
              stroke={pal.gloss}
              strokeOpacity="0.28"
              strokeWidth="0.5"
            />

            {/* grade glyph — engraved copy first, foil copy on top */}
            <text
              x={CX}
              y={r2(gy + gfs * 0.045)}
              textAnchor="middle"
              fill={pal.shade}
              fillOpacity="0.9"
              fontSize={gfs}
              fontWeight={900}
              fontFamily={SEAL_FONT}
            >
              {grade}
            </text>
            <text
              x={CX}
              y={r2(gy)}
              textAnchor="middle"
              fill={`url(#${uid}g)`}
              fontSize={gfs}
              fontWeight={900}
              fontFamily={SEAL_FONT}
            >
              {grade}
            </text>

            {sheen && (
              <g clipPath={`url(#${uid}c)`}>
                <g className={`${uid}s`}>
                  <rect
                    x="-22"
                    y="-18"
                    width="20"
                    height="136"
                    fill={`url(#${uid}h)`}
                    transform={`rotate(16 ${CX} ${CY})`}
                  />
                </g>
              </g>
            )}
          </g>
        </g>
      </svg>
    </span>
  );
}

/** Sheen variant. Isolated so the grid path never subscribes to preferences. */
function AnimatedSeal(props: Omit<ArtProps, "sheen">) {
  const { preferences, isLoaded } = usePreferences();
  // isLoaded gates the first paint too: preferences come from localStorage in
  // an effect, so animating before it resolves would flash motion at someone
  // who has Performance Mode on (and would risk a hydration mismatch).
  return <SealArt {...props} sheen={isLoaded && !preferences.reducedMotion} />;
}

export function StampSeal({
  username,
  grade,
  size = "md",
  rank = null,
  animated = false,
  fluid = false,
  className,
}: {
  username: string;
  grade: StampGrade;
  size?: "sm" | "md" | "lg";
  rank?: 1 | 2 | 3 | null;
  animated?: boolean;
  /** Size from CSS instead of the px table — see the note at the <span>. The
   *  size prop still decides how much of the name fits. */
  fluid?: boolean;
  className?: string;
}): JSX.Element {
  const shared = { username, grade, size, rank, fluid, className };
  if (!animated) return <SealArt {...shared} sheen={false} />;
  return <AnimatedSeal {...shared} />;
}
