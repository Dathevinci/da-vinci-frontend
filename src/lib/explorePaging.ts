/**
 * ONE definition of "how many pages are there", shared by every explore/browse
 * source — anime (AniList), the manhwa sources behind src/lib/manhwa/sources.ts
 * and the novel sources behind src/lib/novel/sources.ts.
 *
 * It exists so the numbered pager the reader can switch to is fed by ONE rule
 * instead of three hand-rolled ones, and so that rule can be stated once:
 *
 *   A TOTAL IS ONLY EVER REPORTED WHEN AN UPSTREAM ACTUALLY PUBLISHED ONE.
 *
 * `totalPages` / `totalItems` are OPTIONAL and simply ABSENT when unknown. They
 * are never defaulted to 0 or 1, because "we don't know" and "there is exactly
 * one page" are different facts and the client has to be able to tell them
 * apart — one draws a real pager, the other draws Prev/Next with no numbers.
 * An invented "50" is worse than no number at all: the reader clicks page 43
 * and lands on nothing, and nothing downstream can detect that it was a guess.
 */

/** The totals half of a browse/search envelope. Merge into the existing shape. */
export interface PageTotals {
  /** Last page the reader can actually ask for. Absent = the source never said. */
  totalPages?: number;
  /**
   * How many items exist across all pages. Absent = unknown, OR knowable
   * upstream but meaningless after our own filtering — summed per-source
   * counts double-count cross-source duplicates and ignore filtered rows.
   */
  totalItems?: number;
  /**
   * Set when the numbers above are a BOUND rather than a count — they are the
   * best honest answer available, but the reader may see fewer. Clients should
   * render these as "~N" / "N+" rather than as an exact count.
   */
  totalsApproximate?: boolean;
}

/** Pages needed to hold `totalItems` at `perPage`, or undefined if unknowable. */
export function pagesForItems(totalItems: unknown, perPage: number): number | undefined {
  const n = Number(totalItems);
  if (!Number.isFinite(n) || n <= 0 || perPage <= 0) return undefined;
  return Math.ceil(n / perPage);
}

/**
 * Read a total page count out of a scraped pager.
 *
 * Both NovelFull-family templates render a windowed pager ("‹ 5 6 7 8 9 ›")
 * PLUS an explicit "Last »" link, so the largest page number on the page is the
 * real last page — verified live: readnovelfull's most-popular list shows
 * 1-7 then a Last link to 118, and page 5 of the same list still shows 118.
 *
 * TWO SIGNALS, because each one alone has a hole:
 *
 *  1. `?page=N` in hrefs — but the markup is HTML-ESCAPED, so a search pager's
 *     link reads `keyword=sword&amp;page=2`. A bare /[?&]page=/ never matches
 *     that (the character before "page" is a semicolon), which is why the
 *     entities are decoded first. This is not hypothetical: it is exactly why
 *     the search pagers currently look like single-page results.
 *  2. `data-page="N"` — the same template carries a ZERO-BASED index on every
 *     pager link, so the Last link reads data-page="117" for page 118. It
 *     survives whatever the hrefs do.
 *
 * Returns undefined rather than guessing whenever it cannot tell, and only
 * claims "one page" when the template rendered NO pager at all next to real
 * results — which for these sites genuinely means the results fit one page.
 */
export function pagerTotalPages(html: string, currentPage: number, resultCount: number): number | undefined {
  if (!html || resultCount <= 0) return undefined;

  const decoded = html.replace(/&amp;/gi, "&");
  const nums: number[] = [];
  for (const m of decoded.matchAll(/[?&]page=(\d+)/g)) nums.push(Number(m[1]));
  for (const m of decoded.matchAll(/data-page="(\d+)"/g)) nums.push(Number(m[1]) + 1);

  const usable = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (usable.length > 0) return Math.max(currentPage, ...usable);

  // No page links anywhere. If the template also rendered no pager, the results
  // really do fit on this one page; if a pager IS there and we parsed nothing
  // out of it, we have no idea and must say so.
  return /class="[^"]*pagination/i.test(decoded) ? undefined : currentPage;
}
