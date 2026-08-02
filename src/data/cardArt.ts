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
 */
export const CARD_ART: Record<string, string> = {
  card_outergod:   "/cards/card_outergod.png",
  card_gatekey:    "/cards/card_gatekey.png",
  card_lastronin:  "/cards/card_lastronin.png",
  card_swordsaint: "/cards/card_swordsaint.png",
  card_secondwind: "/cards/card_secondwind.png",
  card_longmorrow: "/cards/card_longmorrow.png",
  // card_leviathan and card_hollowtide have no painting yet and keep their
  // drawn motifs. Add a line here the day a file lands beside the others.
};

/** The image for a card, or null to keep its drawn motif. */
export function cardArt(id: string, override?: string): string | null {
  return override || CARD_ART[id] || null;
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
