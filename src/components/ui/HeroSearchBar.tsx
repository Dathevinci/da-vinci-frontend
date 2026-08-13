"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Filter, X } from "lucide-react";
import { searchAnime } from "@/lib/jikan";
import { novelCover } from "@/lib/novelImage";
import { useAnimeModal } from "@/components/providers/AnimeModalProvider";
import { LoadingDot } from "@/components/ui/LoadingScreen";

/**
 * THE SEARCH ROW — sits under the hero on each mode's home page.
 *
 * One component, three scopes: the anime row searches anime, the manhwa row
 * searches manhwa, the novel row searches novels. The page decides, so there
 * is no mode toggle to get out of sync with what you are actually looking at.
 *
 * Typing opens a suggestion list — poster, title, and a meta line — and
 * picking one goes straight to it. Enter with nothing highlighted falls
 * through to the full results page instead.
 *
 * The sources are not equal: anime search is a fast API, manhwa is a scrape
 * with a proxy fallback, novel fans out across three sites. So requests are
 * debounced, aborted on the next keystroke, and gated behind a sequence
 * number — a slow reply that lands after a newer one is dropped rather than
 * allowed to overwrite it, which is how a stale list ends up under a query
 * it doesn't match.
 *
 * Deliberately does NOT call useSearchParams: the anime home is a server
 * component with no Suspense boundary of its own, and a hook call in a child
 * there fails `next build` while Vercel keeps serving the last good deploy.
 * Callers that already sit inside a boundary pass `initialValue` down.
 */

type Mode = "anime" | "manhwa" | "novel";

type Suggestion = {
  key: string;
  title: string;
  image: string;
  meta: string;
  raw: any;
};

const MODES: Record<
  Mode,
  { placeholder: string; home: string; focus: string; caret: string; accent: string; filtersHint: string }
> = {
  anime: {
    placeholder: "Search for anime... (e.g., One Piece)",
    home: "/explore",
    focus: "focus:border-violet-400/50",
    caret: "caret-violet-300",
    accent: "text-violet-300",
    filtersHint: "Filter anime by genre, year, season and format",
  },
  manhwa: {
    placeholder: "Search for manhwa... (e.g., Solo Leveling)",
    home: "/manhwa",
    focus: "focus:border-[#dc2626]/50",
    caret: "caret-[#dc2626]",
    accent: "text-[#f87171]",
    filtersHint: "Browse all manhwa with filters",
  },
  novel: {
    placeholder: "Search for novels... (e.g., Overlord)",
    home: "/novel",
    focus: "focus:border-pink-500/50",
    caret: "caret-pink-400",
    accent: "text-pink-400",
    filtersHint: "Browse all novels with filters",
  },
};

/** Shape each source's very different payload into one row format. */
async function fetchSuggestions(mode: Mode, term: string, signal: AbortSignal): Promise<Suggestion[]> {
  if (mode === "manhwa") {
    const res = await fetch(`/api/manhwa?q=${encodeURIComponent(term)}&page=1`, { signal });
    if (!res.ok) throw new Error("manhwa search failed");
    const data = await res.json();
    return (data.results || []).slice(0, 6).map((m: any) => {
      const sourceName = String(m.id).startsWith("vtx:")
        ? "Vortex"
        : String(m.id).startsWith("mna:")
        ? "Manganato"
        : "Asura";
      return {
        key: String(m.id),
        title: m.title,
        image: m.image ? `/api/manhwa-image?url=${encodeURIComponent(m.image)}` : "",
        meta:
          [sourceName, m.status, m.latestChapter, m.rating ? `★ ${m.rating}` : null].filter(Boolean).join(" · ") ||
          "Manga",
        raw: m,
      };
    });
  }

  if (mode === "novel") {
    const res = await fetch(`/api/novels?q=${encodeURIComponent(term)}&page=1`, { signal });
    if (!res.ok) throw new Error("novel search failed");
    const data = await res.json();
    return (data.results || []).slice(0, 6).map((n: any) => {
      const sourceName = n.id.startsWith("nf:")
        ? "NovelFull"
        : n.id.startsWith("lnw:")
        ? "LightNovelWorld"
        : n.id.startsWith("fmtl:")
        ? "FanMTL"
        : "ReadNovelFull";
      return {
        key: String(n.id),
        title: n.title,
        image: novelCover(n.cover) || "",
        meta: [sourceName, n.latestChapter, n.status].filter(Boolean).join(" · ") || "Light Novel",
        raw: n,
      };
    });
  }

  // searchAnime takes no AbortSignal, so this one relies on the sequence
  // guard in the caller to discard a superseded reply.
  const res = await searchAnime({ search: term, page: 1 });
  return ((res?.Page?.media as any[]) || []).slice(0, 6).map((a: any) => ({
    key: String(a.mal_id),
    title: a.title_english || a.title,
    image: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
    meta:
      [a.type, a.year, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(" · ") || "Anime",
    raw: a,
  }));
}

export default function HeroSearchBar({
  mode,
  initialValue = "",
  filtersHref,
  className = "",
}: {
  mode: Mode;
  /** Seeds the box from the URL so a search stays visible in its own results. */
  initialValue?: string;
  /** Renders the Filters button only when a filter surface exists to go to. */
  filtersHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const { openAnime } = useAnimeModal();
  const cfg = MODES[mode];

  const [q, setQ] = useState(initialValue);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Monotonic request id — only the newest reply is allowed to render.
  const seqRef = useRef(0);
  // Set once the user actually types, so seeding the box from ?q= on a
  // results page doesn't immediately reopen the list over those results.
  const typedRef = useRef(false);

  useEffect(() => {
    const term = q.trim();
    if (!typedRef.current) return;

    if (term.length < 2) {
      seqRef.current++;
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const seq = ++seqRef.current;
    const controller = new AbortController();
    setLoading(true);
    setOpen(true);
    // The armed highlight indexes the PREVIOUS query's results, which are
    // still on screen until this reply lands. Leaving it armed means Enter
    // opens a row belonging to a query you have already typed past.
    setActive(-1);

    const t = setTimeout(async () => {
      try {
        const found = await fetchSuggestions(mode, term, controller.signal);
        if (seq !== seqRef.current) return;
        // Drop refs to the previous query's rows so a stale index can never
        // resolve to an unmounted button.
        rowRefs.current.length = found.length;
        setResults(found);
        setActive(-1);
      } catch {
        if (seq === seqRef.current) setResults([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, mode]);

  // Clicking anywhere else dismisses the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Arrow keys move the highlight while focus stays in the input, so the
  // browser never scrolls for us — six rows run past the list's own box.
  useEffect(() => {
    if (active >= 0) rowRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const openItem = (s: Suggestion) => {
    close();
    inputRef.current?.blur();
    // Manhwa and novels navigate to their own pages — their quick-view
    // popups are retired. Anime keeps the detail overlay every other anime
    // surface in the app opens.
    if (mode === "manhwa") router.push(`/manhwa/${encodeURIComponent(s.raw.id)}`);
    else if (mode === "novel") router.push(`/novel/${encodeURIComponent(s.raw.id)}`);
    else openAnime(s.raw);
  };

  // SyntheticEvent, not FormEvent — this is also the "View all results"
  // button's click handler.
  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const term = q.trim();
    close();
    // Empty box, and nothing was searched to begin with: Enter should do
    // nothing rather than throw you off the page you're browsing.
    if (!term && !initialValue) return;
    // Empty box on a results page means "take me back" — otherwise clearing
    // the text would strand you there with no way out but the back button.
    router.push(term ? `${cfg.home}?q=${encodeURIComponent(term)}` : cfg.home);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keystrokes an IME is consuming — picking a kanji candidate, committing
    // a phrase — belong to the IME. Chrome still reports them as Enter and
    // ArrowDown, so without this a Japanese title can't be typed at all.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === "Escape") {
      close();
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // A highlighted suggestion wins over the form's submit.
      e.preventDefault();
      openItem(results[active]);
    }
  };

  const term = q.trim();

  return (
    <div className={className}>
      <div ref={wrapRef} className="relative">
        <form
          role="search"
          onSubmit={submit}
          aria-label={`Search ${mode}`}
          className="flex items-center gap-2.5"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                typedRef.current = true;
                setQ(e.target.value);
              }}
              onFocus={() => {
                // Also reopen while a request is still out: dismissing the
                // list mid-fetch would otherwise leave the reply rendering
                // into a closed dropdown, unreachable without more typing.
                if (results.length > 0 || (loading && q.trim().length >= 2)) setOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={cfg.placeholder}
              aria-label={cfg.placeholder}
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-controls={`dv-search-${mode}`}
              aria-activedescendant={active >= 0 ? `dv-search-${mode}-${active}` : undefined}
              autoComplete="off"
              className={`w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 ${
                q ? "pr-11" : "pr-4"
              } font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none ${cfg.focus} ${cfg.caret} transition-colors`}
            />

            {loading && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                <LoadingDot />
              </span>
            )}

            {/* Clearing refocuses the input: this button unmounts the moment
                the box empties, and focus would otherwise fall to the body. */}
            {!loading && q && (
              <button
                type="button"
                onClick={() => {
                  typedRef.current = true;
                  setQ("");
                  close();
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* leading-5 matches the input's line-height — without it, text-xs
              makes this button render 4px shorter than the box beside it. */}
          {filtersHref && (
            <Link
              href={filtersHref}
              title={cfg.filtersHint}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-mono text-xs font-black leading-5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Link>
          )}
        </form>

        {open && term.length >= 2 && (
          <div
            id={`dv-search-${mode}`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f] shadow-2xl shadow-black/60"
          >
            {results.length > 0 ? (
              <>
                {/* The row ref uses a block body deliberately: React 19 treats
                    a value returned from a callback ref as a cleanup function. */}
                <div className="max-h-[60vh] overflow-y-auto p-1.5">
                  {results.map((s, i) => (
                    <button
                      key={s.key}
                      ref={(el) => { rowRefs.current[i] = el; }}
                      id={`dv-search-${mode}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => openItem(s)}
                      className={`flex w-full items-center gap-4 rounded-xl p-2.5 text-left transition ${
                        i === active ? "bg-white/[0.07]" : "hover:bg-white/5"
                      }`}
                    >
                      <img
                        src={s.image}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className={`h-16 w-12 shrink-0 rounded-md bg-[#151518] object-cover ${
                          mode === "anime" ? "" : "hq-image"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-white">{s.title}</span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                          {s.meta}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={submit}
                  className={`w-full border-t border-white/10 px-4 py-3 text-center font-mono text-xs font-black transition hover:bg-white/5 ${cfg.accent}`}
                >
                  View all results for &ldquo;{term}&rdquo;
                </button>
              </>
            ) : loading ? (
              <div className="flex items-center justify-center gap-3 py-8 font-mono text-xs text-slate-500">
                <LoadingDot /> Searching
              </div>
            ) : (
              <div className="py-8 text-center font-mono text-xs text-slate-500">
                No {mode === "novel" ? "novels" : mode} found for &ldquo;{term}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
