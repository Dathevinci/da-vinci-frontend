import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage, IMangaChapter } from '@/lib/asura/models';
import { ManhwaRow } from './recency';

/**
 * VortexScans — the second manhwa source, added 2026-08-13.
 *
 * CHOSEN ON EVIDENCE, not on reputation. Nine candidates were probed FROM
 * PRODUCTION, because a source that answers a home connection tells you
 * nothing: FlameComics serves a laptop its whole catalogue and answers Vercel
 * with 403 + cf-mitigated=challenge, which is why it was removed. Vortex was
 * the only candidate to complete the entire chain from Vercel — browse,
 * chapter list, page image URLs, and a real 2MB image actually fetched. Comick
 * got as far as chapter lists and had no page images at all; NatoManga 403'd.
 *
 * IT IS AN ASTRO SITE, so its data arrives as island props rather than as
 * markup: each interactive component is rendered with a props="..." attribute
 * holding HTML-escaped JSON. That is a far better source than the DOM, and on
 * this site it is not merely nicer — it is the difference between correct and
 * badly wrong. See readChapters.
 */

/** Where Vortex serves covers and pages. Must stay allowlisted in next.config. */
const CDN_HOST = 'storage.vortexscans.org';

/** The full catalogue is ~420 series at 36 a page; cached for search. */
const CATALOGUE_TTL = 10 * 60 * 1000;
let catalogueCache: { at: number; rows: ManhwaRow[] } | null = null;
let catalogueInflight: Promise<ManhwaRow[]> | null = null;

interface VortexChapter {
  id?: number;
  number?: number | string;
  slug?: string;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isLocked?: boolean;
  isAccessible?: boolean;
}

interface VortexPost {
  id?: number;
  slug?: string;
  postTitle?: string;
  postContent?: string;
  featuredImage?: string;
  seriesType?: string;
  seriesStatus?: string;
  averageRating?: number;
  genres?: Array<{ name?: string }>;
  chapters?: VortexChapter[];
  updatedAt?: string;
}

export default class VortexScans extends MangaParser {
  override readonly name = 'VortexScans';
  protected override readonly baseUrl = 'https://vortexscans.org';
  protected override readonly logo = 'https://vortexscans.org/favicon.ico';
  protected override readonly classPath = 'MANGA.VortexScans';

  /** Vortex's own page size on /series — mirrored so our pages line up. */
  private static readonly PER_PAGE = 36;

  constructor() {
    super();
    this.client.defaults.headers.common['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  }

  // ── Astro island decoding ─────────────────────────────────────────────────

  private static unescapeAttr(raw: string): string {
    return raw
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /**
   * Astro serialises every prop value as `[typeCode, value]`, nested all the
   * way down, so the raw JSON is unusable until it is unwrapped.
   */
  private static unwrap(v: any): any {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') return VortexScans.unwrap(v[1]);
    if (Array.isArray(v)) return v.map((x) => VortexScans.unwrap(x));
    if (v && typeof v === 'object') {
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = VortexScans.unwrap(v[k]);
      return out;
    }
    return v;
  }

  /**
   * Every island's decoded props. Returns [] rather than throwing on anything
   * unexpected — a Vortex outage or a redesign must degrade to "no rows", not
   * take the whole merged browse down with it.
   */
  private islandProps(html: string): any[] {
    if (!html || typeof html !== 'string') return [];
    const out: any[] = [];
    for (const m of html.matchAll(/props="([^"]*)"/g)) {
      try {
        out.push(VortexScans.unwrap(JSON.parse(VortexScans.unescapeAttr(m[1]))));
      } catch {
        /* not every props attribute is JSON we care about */
      }
    }
    return out;
  }

  /** The first island whose props satisfy `pick`. */
  private findIsland<T>(html: string, pick: (p: any) => T | undefined): T | undefined {
    for (const p of this.islandProps(html)) {
      const hit = pick(p);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  // ── mapping ───────────────────────────────────────────────────────────────

  private determineStatus(status?: string): MediaStatus {
    switch ((status || '').toUpperCase().trim()) {
      case 'ONGOING': return MediaStatus.ONGOING;
      case 'COMPLETED': return MediaStatus.COMPLETED;
      case 'DROPPED':
      case 'CANCELLED': return MediaStatus.CANCELLED;
      case 'HIATUS': return MediaStatus.HIATUS;
      default: return MediaStatus.UNKNOWN;
    }
  }

  /**
   * A listing row. `updatedAt` is taken from the NEWEST CHAPTER's timestamp,
   * never from the series' own updatedAt — the series field moves when any
   * metadata is edited, and sorting a "Recently Updated" shelf on it is exactly
   * the bug that shelf was fixed for (see recency.ts). Measured on Vortex's own
   * home payload: a series carrying updatedAt 2026-07-19 had a chapter from
   * 2026-08-12, three weeks newer.
   */
  private toResult(p: VortexPost): ManhwaRow | null {
    if (!p || !p.slug || !p.postTitle) return null;
    const chapters = Array.isArray(p.chapters) ? p.chapters : [];
    let newest = 0;
    let newestChapter: VortexChapter | undefined;
    for (const c of chapters) {
      const t = Date.parse(String(c?.createdAt ?? ''));
      if (Number.isFinite(t) && t > newest) { newest = t; newestChapter = c; }
    }
    const num = newestChapter?.number;
    return {
      id: `vtx:${p.slug}`,
      title: p.postTitle,
      image: p.featuredImage || undefined,
      status: this.determineStatus(p.seriesStatus),
      rating: typeof p.averageRating === 'number' && p.averageRating > 0 ? String(p.averageRating) : undefined,
      latestChapter: num !== undefined && num !== null ? `Chapter ${num}` : undefined,
      updatedAt: newest > 0 ? new Date(newest).toISOString() : undefined,
    };
  }

  private rowsFrom(posts: any): ManhwaRow[] {
    if (!Array.isArray(posts)) return [];
    return posts.map((p) => this.toResult(p)).filter((r): r is ManhwaRow => r !== null);
  }

  private empty(page: number): ISearch<ManhwaRow> {
    return { currentPage: page, hasNextPage: false, results: [] };
  }

  // ── browse ────────────────────────────────────────────────────────────────

  /**
   * One page of the catalogue, straight from Vortex's own paging.
   *
   * `initialTotalCount` is the real catalogue size (420 at the time of writing),
   * so totalPages here is a MEASUREMENT rather than a guess — the contract in
   * src/lib/explorePaging.ts. `filters` is accepted and ignored: Vortex's
   * listing takes no query parameters that actually filter (q=, search= and
   * title= were each verified to return the identical unfiltered 420), so
   * pretending otherwise would silently serve unfiltered rows as filtered ones.
   */
  async getSeries(page: number = 1, _filters?: any): Promise<ISearch<ManhwaRow>> {
    const p = Math.max(1, page);
    try {
      const html = await this.request<string>(`${this.baseUrl}/series?page=${p}`);
      const island = this.findIsland<{ posts: any[]; total?: number }>(html, (props) =>
        Array.isArray(props?.initialPosts)
          ? { posts: props.initialPosts, total: Number(props.initialTotalCount) }
          : undefined
      );
      if (!island) return this.empty(p);

      const results = this.rowsFrom(island.posts);
      const total = Number.isFinite(island.total) && (island.total as number) > 0 ? (island.total as number) : undefined;
      const totalPages = total ? Math.max(1, Math.ceil(total / VortexScans.PER_PAGE)) : undefined;
      return {
        currentPage: p,
        hasNextPage: totalPages ? p < totalPages : results.length >= VortexScans.PER_PAGE,
        results,
        ...(total ? { totalItems: total, totalPages } : {}),
      };
    } catch (e) {
      console.error('VortexScans getSeries error:', e);
      return this.empty(p);
    }
  }

  /**
   * The whole catalogue, for searching.
   *
   * Vortex has NO server-side search — /series?q=, ?search= and ?title= were
   * each measured returning the same unfiltered 420 rows — so matching has to
   * happen here, which means holding the catalogue. It is ~12 pages, fetched
   * once per TTL and shared by every concurrent caller through an in-flight
   * promise so a cold cache cannot start twelve fetches per visitor.
   */
  private async catalogue(): Promise<ManhwaRow[]> {
    const now = Date.now();
    if (catalogueCache && now - catalogueCache.at < CATALOGUE_TTL) return catalogueCache.rows;
    if (catalogueInflight) return catalogueInflight;

    catalogueInflight = (async () => {
      const first = await this.getSeries(1);
      const rows = [...first.results];
      const totalPages = Math.min(Number((first as any).totalPages) || 1, 40);
      if (totalPages > 1) {
        const rest = await Promise.allSettled(
          Array.from({ length: totalPages - 1 }, (_, i) => this.getSeries(i + 2))
        );
        for (const r of rest) if (r.status === 'fulfilled') rows.push(...r.value.results);
      }
      // Only cache something that actually parsed; caching an empty catalogue
      // would pin a transient outage in front of search for the whole TTL.
      if (rows.length > 0) catalogueCache = { at: Date.now(), rows };
      return rows;
    })().finally(() => {
      catalogueInflight = null;
    });

    return catalogueInflight;
  }

  async search(query: string, page: number = 1): Promise<ISearch<ManhwaRow>> {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return this.empty(page);
    try {
      const all = await this.catalogue();
      const matches = all.filter((r) => (r.title || '').toLowerCase().includes(q));
      const p = Math.max(1, page);
      const start = (p - 1) * VortexScans.PER_PAGE;
      const slice = matches.slice(start, start + VortexScans.PER_PAGE);
      return {
        currentPage: p,
        hasNextPage: matches.length > start + slice.length,
        results: slice,
        totalItems: matches.length,
        totalPages: Math.max(1, Math.ceil(matches.length / VortexScans.PER_PAGE)),
      };
    } catch (e) {
      console.error('VortexScans search error:', e);
      return this.empty(page);
    }
  }

  // ── home rails ────────────────────────────────────────────────────────────

  /**
   * Both rails come from ONE fetch of the home page, which carries several
   * island lists: `posts` is the latest-updates feed, `initalPosts` (Vortex's
   * own spelling) the browse-style grid, and `sliderPosts` the featured strip.
   */
  private async home(): Promise<{ popular: ManhwaRow[]; latest: ManhwaRow[] }> {
    try {
      const html = await this.request<string>(`${this.baseUrl}/`);
      const props = this.islandProps(html);
      const pick = (key: string) => {
        for (const p of props) if (Array.isArray(p?.[key]) && p[key].length > 0) return this.rowsFrom(p[key]);
        return [];
      };
      const latest = pick('posts');
      const grid = pick('initalPosts');
      const slider = pick('sliderPosts');
      return {
        // The featured strip is the closest thing Vortex publishes to "popular";
        // the grid backs it up when the strip is short.
        popular: (slider.length > 0 ? slider : grid).slice(0, 20),
        latest: (latest.length > 0 ? latest : grid).slice(0, 20),
      };
    } catch (e) {
      console.error('VortexScans home error:', e);
      return { popular: [], latest: [] };
    }
  }

  async getPopularToday(): Promise<ISearch<ManhwaRow>> {
    const { popular } = await this.home();
    return { currentPage: 1, hasNextPage: false, results: popular };
  }

  async getLatestUpdates(page: number = 1): Promise<ISearch<ManhwaRow>> {
    if (page > 1) return this.empty(page);
    const { latest } = await this.home();
    return { currentPage: 1, hasNextPage: false, results: latest };
  }

  // ── one series ────────────────────────────────────────────────────────────

  /**
   * THE CHAPTER LIST MUST COME FROM THE ISLAND, NOT THE MARKUP.
   *
   * The rendered page shows a WINDOW of chapters — measured at 21 links — while
   * the island prop `initialChap` carries the whole list. Verified across three
   * series: initialChap held 255, 183 and 210 entries and matched
   * totalChapterCount exactly in each case, newest first down to chapter 1.
   *
   * So scraping the DOM here would have silently truncated a 255-chapter series
   * to 21 and looked entirely plausible doing it. This app has already shipped
   * that bug once, from a rescue parser serving a shorter list, and the report
   * it produced — "some manhwa don't show all chapters" — is the reason the
   * count is cross-checked against totalChapterCount below rather than trusted.
   */
  private readChapters(html: string, seriesSlug: string): { chapters: IMangaChapter[]; declared?: number } {
    const island = this.findIsland<{ chaps: VortexChapter[]; declared?: number }>(html, (p) =>
      Array.isArray(p?.initialChap) ? { chaps: p.initialChap, declared: Number(p.totalChapterCount) } : undefined
    );
    if (!island) return { chapters: [] };

    const chapters: IMangaChapter[] = island.chaps
      .filter((c) => c && c.slug)
      .map((c): IMangaChapter => {
        const num = c.number ?? '';
        const name = String(c.title || '').trim();
        return {
          id: `vtx:${seriesSlug}|${c.slug}`,
          title: name ? `Chapter ${num} - ${name}` : `Chapter ${num}`,
          releaseDate: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
          // Vortex sells early access. A locked chapter that opens to a
          // paywall reads as a broken reader, so it is flagged rather than
          // silently listed as readable.
          isLocked: c.isLocked === true || c.isAccessible === false,
        };
      })
      .sort((a, b) => {
        const an = Number(/chapter\s*([\d.]+)/i.exec(a.title || '')?.[1] ?? 0);
        const bn = Number(/chapter\s*([\d.]+)/i.exec(b.title || '')?.[1] ?? 0);
        return bn - an;
      });

    return { chapters, declared: Number.isFinite(island.declared) ? island.declared : undefined };
  }

  override async fetchMangaInfo(mangaId: string): Promise<IMangaInfo> {
    const slug = String(mangaId).replace(/^vtx:/, '');
    try {
      const html = await this.request<string>(`${this.baseUrl}/series/${slug}`);

      const post = this.findIsland<VortexPost>(html, (p) =>
        p?.post && typeof p.post === 'object' && p.post.postTitle ? (p.post as VortexPost) : undefined
      );
      const { chapters, declared } = this.readChapters(html, slug);

      if (!post && chapters.length === 0) {
        throw new Error(`VortexScans returned no series payload for "${slug}"`);
      }

      // A list shorter than the source's own count means we parsed a partial
      // page, not that chapters are missing upstream. Say so rather than
      // presenting the short list as complete.
      if (declared && chapters.length < declared) {
        console.warn(`[vortex] "${slug}" parsed ${chapters.length} of ${declared} chapters`);
      }

      const title = post?.postTitle || slug.replace(/-/g, ' ');
      return {
        id: `vtx:${slug}`,
        title,
        image: post?.featuredImage || undefined,
        status: this.determineStatus(post?.seriesStatus),
        rating: typeof post?.averageRating === 'number' && post.averageRating > 0 ? String(post.averageRating) : undefined,
        // postContent is HTML; the detail page renders plain text.
        description: post?.postContent ? String(post.postContent).replace(/<[^>]+>/g, '').trim() : undefined,
        genres: Array.isArray(post?.genres)
          ? post!.genres!.map((g) => g?.name).filter((n): n is string => !!n)
          : undefined,
        chapters,
      };
    } catch (e) {
      console.error(`VortexScans fetchMangaInfo error for ${slug}:`, e);
      throw e;
    }
  }

  /**
   * The ordered page images of one chapter.
   *
   * ANCHORED ON THE PAGE-FILENAME PATTERN, not merely on the CDN host. The
   * chapter document also carries the series cover and the site logo from the
   * same storage host, and a host-only filter would insert both into the middle
   * of the reader. Vortex names real pages `page-0001_…`, which both identifies
   * them and gives the sort order — so the pages are ordered by that number
   * rather than by document position.
   */
  override async fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]> {
    const raw = String(chapterId).replace(/^vtx:/, '');
    const [seriesSlug, chapterSlug] = raw.split('|');
    if (!seriesSlug || !chapterSlug) throw new Error('Invalid VortexScans chapter ID');

    try {
      const html = await this.request<string>(`${this.baseUrl}/series/${seriesSlug}/${chapterSlug}`);
      const re = new RegExp(
        `https?://${CDN_HOST.replace(/\./g, '\\.')}/[^"'\\\\ )]*?page-(\\d+)[^"'\\\\ )]*\\.(?:webp|jpe?g|png|avif)`,
        'gi'
      );

      const seen = new Set<string>();
      const found: { n: number; img: string }[] = [];
      for (const m of html.matchAll(re)) {
        const img = m[0];
        if (seen.has(img)) continue;
        seen.add(img);
        found.push({ n: Number(m[1]) || 0, img });
      }

      found.sort((a, b) => a.n - b.n);
      return found.map((f, i) => ({ page: i + 1, img: f.img }));
    } catch (e) {
      console.error(`VortexScans fetchChapterPages error for ${raw}:`, e);
      throw e;
    }
  }
}
