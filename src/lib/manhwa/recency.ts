import { IMangaResult } from "@/lib/asura/models";

/**
 * THE RECENCY FIELD THE "RECENTLY UPDATED" SHELF IS SORTED ON.
 *
 * WHY THIS FILE EXISTS. The home rail merged four sources by CONCATENATION —
 * Asura's rows, then Flame's, then Rizz's, then Pill's — so the shelf was only
 * ever "newest-first" WITHIN each block, and two of the four were not even
 * ordered by recency to begin with (they were handing back their alphabetical
 * back catalogue). The owner saw the obvious symptom: old series sitting in a
 * shelf labelled Recently Updated. A shelf that claims an ordering has to
 * actually carry the number it is ordered by, so every source that publishes
 * one now attaches it here.
 *
 * `updatedAt` IS THE SERIES' NEWEST CHAPTER RELEASE TIME, not a metadata edit.
 * That distinction is not pedantry — it is the specific trap this file was
 * written to avoid. FlameComics publishes BOTH: a `last_edit` that moves when
 * anyone touches the row (cover swap, tag fix, description edit) and a real
 * per-chapter `release_date`. Measured live, they disagree badly: "The Former
 * Supreme" carried last_edit 2026-07-29 while its newest chapter had landed
 * 2026-08-12, and "The Ancient Sovereign of Eternity" carried last_edit
 * 2024-08-07 while sitting fifth in Flame's own latest feed. Sorting on
 * last_edit would have produced a shelf that looked sorted and was wrong —
 * the same class of bug, one layer deeper.
 *
 * IT IS AN ISO 8601 STRING, not an epoch number, because the four sources
 * disagree about units (Flame and Rizz publish epoch SECONDS, MangaPill and
 * Asura publish ISO) and a bare number carries no evidence of which it is. A
 * seconds value read as milliseconds lands in 1970 and sorts to the bottom
 * forever, silently. ISO round-trips through JSON, is directly comparable, and
 * is what the client would want to render "2 hours ago" from anyway.
 */
export interface ManhwaRow extends IMangaResult {
  /** ISO 8601 instant of this series' newest chapter, when the source says. */
  updatedAt?: string;
}

/**
 * A row's recency as a sortable number; 0 when the source never said.
 *
 * Reads `latest_chapters` as well as `updatedAt` so AsuraScans needs no change
 * — it already ships its chapter feed on every row, and `src/lib/asura` is
 * deliberately not modified by this fix. Verified live that the newest
 * `latest_chapters[].published_at` equals the API's own `last_chapter_at` on
 * every row of page 1, so this is the same number the API sorts by.
 */
export function recencyOf(row: ManhwaRow | undefined | null): number {
  if (!row) return 0;

  const own = row.updatedAt ? Date.parse(row.updatedAt) : NaN;
  if (Number.isFinite(own)) return own;

  let best = 0;
  for (const c of row.latest_chapters || []) {
    const ms = Date.parse(String(c?.published_at ?? ""));
    if (Number.isFinite(ms) && ms > best) best = ms;
  }
  return best;
}

/**
 * Newest-first across sources, with UNDATED ROWS APPENDED rather than mixed in.
 *
 * THE ONE REAL DECISION HERE. A row whose source publishes no timestamp cannot
 * be placed by evidence, and the two wrong answers are not symmetric:
 *
 *  · Treating undated as NEWEST (what a naive `?? Date.now()` does, and what
 *    plain concatenation did by accident) puts an unknown above a chapter we
 *    can prove landed an hour ago. That IS the reported bug.
 *  · Interleaving them by some guessed position — catalogue rank, alphabetical
 *    index — dresses a guess up as a measurement. The shelf would look sorted
 *    and be lying, which is worse than visibly degrading.
 *
 * So undated rows go last, keeping the merge's own best-first order among
 * themselves. The claim the shelf makes stays true for every row above them,
 * and a source that cannot answer "what changed recently" cannot outrank one
 * that can. In practice all four sources now DO answer, so this branch is the
 * safety net for a source that breaks, not the normal path.
 *
 * Ties keep their merge order (Array#sort is stable), so equal timestamps fall
 * back to the caller's deliberate best-metadata-first source ordering.
 */
export function sortByRecency<T extends ManhwaRow>(rows: T[]): T[] {
  const dated: T[] = [];
  const undated: T[] = [];
  for (const r of rows) (recencyOf(r) > 0 ? dated : undated).push(r);
  dated.sort((a, b) => recencyOf(b) - recencyOf(a));
  return [...dated, ...undated];
}
