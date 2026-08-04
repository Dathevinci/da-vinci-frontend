"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Filter, X } from "lucide-react";

/**
 * THE SEARCH ROW — sits under the hero on each mode's home page.
 *
 * One component, three scopes: the anime row searches anime, the manhwa row
 * searches manhwa, the novel row searches novels. The page decides, so there
 * is no mode toggle to get out of sync with what you are actually looking at.
 *
 * It NAVIGATES on submit rather than filtering as you type. Manhwa searches
 * go through a scraper with a proxy fallback and novel search fans out across
 * three sources; typing "one piece" would fire six of those before you reach
 * the "e". Enter (or the button) is the trigger.
 *
 * Deliberately does NOT call useSearchParams: the anime home is a server
 * component with no Suspense boundary of its own, and a hook call in a child
 * there fails `next build` while Vercel quietly keeps serving the last good
 * deploy. Callers that already sit inside a boundary pass `initialValue` down.
 */

type Mode = "anime" | "manhwa" | "novel";

const MODES: Record<
  Mode,
  { placeholder: string; home: string; focus: string; caret: string; filtersHint: string }
> = {
  anime: {
    placeholder: "Search for anime... (e.g., One Piece)",
    home: "/explore",
    focus: "focus:border-violet-400/50",
    caret: "caret-violet-300",
    filtersHint: "Filter anime by genre, year, season and format",
  },
  manhwa: {
    placeholder: "Search for manhwa... (e.g., Solo Leveling)",
    home: "/manhwa",
    focus: "focus:border-[#dc2626]/50",
    caret: "caret-[#dc2626]",
    filtersHint: "Browse all manhwa with filters",
  },
  novel: {
    placeholder: "Search for novels... (e.g., Overlord)",
    home: "/novel",
    focus: "focus:border-pink-500/50",
    caret: "caret-pink-400",
    filtersHint: "Browse all novels with filters",
  },
};

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
  const cfg = MODES[mode];
  const [q, setQ] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    // Empty box, and nothing was searched to begin with: Enter should do
    // nothing rather than throw you off the page you're browsing.
    if (!term && !initialValue) return;
    // Empty box on a results page means "take me back" — otherwise clearing
    // the text would strand you there with no way out but the back button.
    router.push(term ? `${cfg.home}?q=${encodeURIComponent(term)}` : cfg.home);
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      aria-label={`Search ${mode}`}
      className={`flex items-center gap-2.5 ${className}`}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={cfg.placeholder}
          aria-label={cfg.placeholder}
          enterKeyHint="search"
          className={`w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 ${
            q ? "pr-11" : "pr-4"
          } font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none ${cfg.focus} ${cfg.caret} transition-colors`}
        />
        {/* Clearing refocuses the input: this button unmounts the moment the
            box empties, and focus would otherwise fall to the document body. */}
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* leading-5 matches the input's line-height — without it, text-xs makes
          this button render 4px shorter than the box beside it. */}
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
  );
}
