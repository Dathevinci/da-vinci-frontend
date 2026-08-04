/**
 * PAINTED CARD ART.
 *
 * Any card id listed here renders a real image instead of its drawn motif.
 * Everything absent keeps the procedural art, so this map is always safe to
 * add to and safe to leave empty.
 *
 * A MANIFEST, NOT EXTENSION PROBING. Guessing .png then .jpg then .webp costs
 * two deliberate 404s per card on a twenty-card grid. One explicit path each.
 *
 * The keys are the real catalog ids, read from the backend's cardCatalog.ts —
 * they are NOT derived from the shop's effect_* namespace, which is a
 * different set of things with confusingly similar names. A key that matches
 * no card fails completely silently: no error, no warning, the motif renders
 * as normal and the art simply never appears. warnUnknownArtKeys() below
 * exists to make that loud in development.
 *
 * Files live in public/cards/ and MUST be committed. An image present on disk
 * but never `git add`ed 404s on Vercel — this repo has already shipped that
 * exact bug once with the landing artwork.
 *
 * Each painting also has a 300px thumbnail in public/cards/sm/ as .jpg,
 * generated from the same source. See cardArt() for why that exists.
 */
export const CARD_ART: Record<string, string> = {
  // ── EPIC ── the only tier that survived the card reset. Everything else
  // was retired, and its art keys went with it: a key matching no card
  // fails completely SILENTLY (no error, the motif just renders), so a
  // stale entry here is invisible rather than loud.
  //
  // card_trenchmaw is a surviving epic with no file — it renders its drawn
  // motif. Add a line the day art lands.
  card_voidgaze:     "/cards/card_voidgaze.png",
  card_ninehands:    "/cards/card_ninehands.png",
  card_crimsonsea:   "/cards/card_crimsonsea.png",
  card_unblinking:   "/cards/card_unblinking.png",
  card_fallenstar:   "/cards/card_fallenstar.png",
  card_onimask:      "/cards/card_onimask.png",
  card_communion:    "/cards/card_communion.png",
  card_ironvow:      "/cards/card_ironvow.png",
  card_gravebloom:   "/cards/card_gravebloom.png",
  card_blackreach:   "/cards/card_blackreach.png",
  card_lastretainer: "/cards/card_lastretainer.png",
  card_lampofhours:  "/cards/card_lampofhours.png",
};

/**
 * The image for a card, or null to keep its drawn motif.
 *
 * `size` picks WHICH FILE, never whether art shows at all. Every card with a
 * painting gets one at every size — small slots just receive a 300px JPEG
 * (~29 KB) rather than the full PNG (~119 KB).
 *
 * That second file is doing real work. next.config sets images.unoptimized, so
 * there is no resizing layer to lean on: without it a 48px bench slot
 * downloads the entire painting. A duel board draws about twelve cards and the
 * deck builder draws a whole collection, so it was most of 2.3 MB fetched to
 * paint thumbnails a few pixels across.
 *
 * 300px covers the largest "small" use (~150px) at 2x DPI. The middle band
 * (binder tiles at 216, the reveal hero at 260) gets a 640px JPEG from
 * /cards/md/ — before that band existed those slots each pulled the full
 * PNG, and a binder full of legendaries fetched megabytes to paint tiles.
 * The full file only loads from 340 up, where its detail is actually visible.
 */
export function cardArt(id: string, override?: string, size = 999): string | null {
  if (override) return override;
  const full = CARD_ART[id];
  if (!full) return null;
  if (size < 200) return full.replace("/cards/", "/cards/sm/").replace(/\.png$/, ".jpg");
  if (size < 340) return full.replace("/cards/", "/cards/md/").replace(/\.png$/, ".jpg");
  return full;
}

let warned = false;
/**
 * Shout in development if a manifest key matches no card in the live catalog.
 * A typo here is otherwise invisible — the card just keeps its motif and you
 * conclude the feature was never built.
 */
export function warnUnknownArtKeys(catalogIds: string[]) {
  if (warned || process.env.NODE_ENV === "production" || catalogIds.length === 0) return;
  warned = true;
  const known = new Set(catalogIds);
  const orphans = Object.keys(CARD_ART).filter((id) => !known.has(id));
  if (orphans.length) {
    console.warn(
      `[cardArt] ${orphans.length} art entr${orphans.length === 1 ? "y matches" : "ies match"} no card in the catalog: ` +
        `${orphans.join(", ")}. Their images will never render. Check the ids against the backend cardCatalog.`
    );
  }
}
