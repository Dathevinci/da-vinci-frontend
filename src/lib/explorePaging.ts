/**
 * ONE definition of "how many pages are there", shared by every explore/browse
 * source — anime (AniList), manhwa (AsuraScans + MangaDex + MangaRead) and
 * novels (ReadNovelFull / NovelFull / LightNovelWorld / Lnori).
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
   * upstream but meaningless after our own filtering (see combineTotals).
   */
  totalItems?: number;
  /**
   * Set when the numbers above are a BOUND rather than a count — they are the
   * best honest answer available, but the reader may see fewer. Clients should
   * render these as "~N" / "N+" rather than as an exact count.
   */
  totalsApproximate?: boolean;
}

/** What one upstream told us about its own pagination. */
export interface SourcePaging extends PageTotals {
  hasNextPage: boolean;
}

/** Pages needed to hold `totalItems` at `perPage`, or undefined if unknowable. */
export function pagesForItems(totalItems: unknown, perPage: number): number | undefined {
  const n = Number(totalItems);
  if (!Number.isFinite(n) || n <= 0 || perPage <= 0) return undefined;
  return Math.ceil(n / perPage);
}

/**
 * Fold several sources' pagination into one answer for a MERGED list.
 *
 * The merged view pages 1:1 with its sources — our page N asks each source for
 * its page N — so the last page the reader can reach is the deepest last page
 * any contributing source has. That part is arithmetic, not estimation.
 *
 * THE BLIND-SOURCE RULE is what keeps it honest. If a source says "there is
 * another page" but never says how many it has (MangaRead publishes no count at
 * all), then the page space is genuinely unbounded as far as we know, and any
 * number we printed would be a floor dressed up as a total. So we report
 * NOTHING and let the client fall back to its degraded pager. Reporting
 * `hasNextPage` beyond a stated `totalPages` is the one combination that must
 * never ship: it makes the pager and the scroller contradict each other.
 *
 * `totalItems` is dropped for merges on purpose — see the manhwa note in
 * src/lib/manhwa/sources.ts. Summing per-source counts double-counts every
 * cross-source duplicate and ignores every row our filters drop.
 */
export function combineTotals(
  parts: SourcePaging[],
  currentPage: number,
  opts: { approximate?: boolean } = {}
): PageTotals {
  const blind = parts.some((p) => p.hasNextPage && typeof p.totalPages !== "number");
  if (blind) return {};

  const known = parts
    .map((p) => p.totalPages)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (known.length === 0) return {};

  const reported = Math.max(...known);
  // NEVER manufacture a total out of the reader's own page number. Clamping
  // with Math.max(currentPage, ...) was there to avoid printing the
  // self-contradictory "Page 30 of 17", but it bought that by asserting 30
  // pages exist — over an empty grid, on an out-of-range deep link. When the
  // reader is past everything the sources claim, we simply do not know the
  // shape any more: report nothing and let the degraded pager say so.
  if (currentPage > reported) return {};
  return opts.approximate ? { totalPages: reported, totalsApproximate: true } : { totalPages: reported };
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
