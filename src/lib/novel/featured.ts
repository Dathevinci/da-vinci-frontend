/**
 * THE FEATURED NOVEL — one id, shared by every surface that dresses it up.
 *
 * The Must Read spotlight on the novel home and the purple-aura treatment on
 * the detail page both key off THIS constant, so changing the featured title
 * is one edit and the two can never disagree about who wears the crown.
 */
export const FEATURED_NOVEL_ID = "rr:142993";

export function isFeaturedNovel(id: string | null | undefined): boolean {
  return String(id || "") === FEATURED_NOVEL_ID;
}
