/**
 * WHICH SOURCE AN ID BELONGS TO — the client-safe half of the router.
 *
 * src/lib/manhwa/sources.ts owns the real dispatch, but it pulls in axios and
 * cheerio through the adapters and can never be imported by a client
 * component. So the surfaces each hard-coded their own prefix test inline —
 * and when the source line-up changed, every one of those tests was left
 * behind naming a prefix nothing produces any more, while the sources that
 * replaced it went unguarded. A guard that names the ONE source to exclude
 * fails open the moment the line-up moves, which is exactly what happened.
 *
 * Keeping the knowledge in one importable place is the fix, and the tests
 * below ask about an id's SHAPE so a source added later is handled by default
 * rather than by being remembered. The prefixes here MUST match the ADAPTERS
 * table in sources.ts.
 */

/**
 * Display names, keyed by id prefix. A bare id is AsuraScans.
 *
 * Only `vtx:` is live. The rest are HISTORICAL — those sources were removed on
 * 2026-08-13 and nothing produces their ids any more. They stay because
 * people's libraries still hold rows saved under them, and a row that says
 * "RizzComics" is telling the truth about where it came from, whereas deleting
 * the entry would make it claim to be AsuraScans and mislead.
 *
 * Add a new source's prefix here at the same time as its ADAPTERS entry in
 * sources.ts, or its rows will be mislabelled in exactly that way.
 */
const SOURCE_LABELS: Record<string, string> = {
  "vtx:": "VortexScans", // live
  // mna: was ONCE legacy-Manganato-served-by-MangaRead; the prefix now belongs
  // to the live Manganato source, so the label follows it. Old rows point at
  // the same site either way, so nothing is mislabelled by the change —
  // whereas keeping "MangaRead" put a wrong source name on every new row.
  "mna:": "Manganato", // live
  "mse:": "Mangasee", // live (Mangasee / WeebCentral)
  "flc:": "FlameComics",
  "rzc:": "RizzComics",
  "mpl:": "MangaPill",
  "mrd:": "MangaRead",
};

/** The human name of the site a series came from — for the detail page's meta. */
export function manhwaSourceLabel(id: string | null | undefined): string {
  const raw = String(id || "");
  for (const [prefix, label] of Object.entries(SOURCE_LABELS)) {
    if (raw.startsWith(prefix)) return label;
  }
  return "AsuraScans";
}

/**
 * Can a chapter id be DERIVED from this series id and a chapter number?
 *
 * Only for AsuraScans, whose chapter ids are literally `<series-slug>|<number>`
 * — which is why its rows can deep-link straight to a chapter from a card.
 *
 * Every other source's chapter id contains something unguessable: FlameComics
 * uses an opaque per-chapter token, RizzComics a self-contained chapter slug,
 * MangaPill a numeric chapter key. Synthesising `flc:12|100` for any of them
 * builds a link that resolves to nothing, so those rows must fall back to the
 * series page — which lists their real chapters.
 *
 * Written as "has no source prefix" rather than as a list of the sources that
 * can't, so a source added later is excluded by DEFAULT. The old form named
 * the one source to exclude, which is why it silently started allowing three.
 */
export function canDeriveChapterId(seriesId: string | null | undefined): boolean {
  return !/^[a-z]{2,5}:/.test(String(seriesId || ""));
}

/**
 * The chapter number carried by a chapter id, or null when the id doesn't hold
 * one.
 *
 * THE RULE IS "ONLY WHERE A NUMBER PROVABLY IS ONE", because the failure mode
 * here is a confident wrong answer rather than a missing one. Every id in this
 * app is full of digits that are not chapter numbers — MangaPill's
 * `mpl:8136-20203000/…` leads with a series key, Rizz's
 * `rzc:r2311170-…-chapter-250` leads with a site-wide prefix, and Flame's
 * `flc:1|385fe46707bd150c` ends in a hex token whose first three characters
 * are digits. Taking "the digits near the end" off any of those yields
 * Ch. 8136, Ch. 2311170 and Ch. 385 respectively — all of which look
 * authoritative and none of which are real.
 *
 * Two shapes qualify, and nothing else:
 *
 *  1. `<series>|<number>` — the AsuraScans shape, where the right half is
 *     ENTIRELY digits. The whole-string test is what rejects Flame's token.
 *  2. a literal `chapter-<n>` / `chapter<n>` inside the id — anchored on the
 *     WORD, which is what makes it safe: it is the source spelling out which
 *     part is the chapter number, so no series key can be mistaken for one.
 *     This is how Rizz and MangaPill ids get a real number.
 *
 * Anything else returns null and the caller falls back to the chapter TITLE,
 * or to a bare "Chapter" — an honest non-answer.
 */
export function chapterNumberFromId(chapterId: string | null | undefined): string | null {
  const raw = String(chapterId || "");

  const right = raw.split("|")[1];
  if (right && /^\d+(\.\d+)?$/.test(right)) return right;

  const named = /chapter[-_\s]*(\d+(?:\.\d+)?)/i.exec(raw);
  return named ? named[1] : null;
}
