"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";
import AnimeDetailView from "@/components/anime/AnimeDetailView";
import { getAnimeDetails, getAnimeDetailsAniList } from "@/lib/jikan";
import { getAnimeDetailsKitsu } from "@/lib/kitsu";

/**
 * /anime/[id] — the detail screen as a real page.
 *
 * It renders the SAME AnimeDetailView as the overlay, so following a
 * comment link from the community or a profile lands on the current
 * design instead of the retired two-column layout. `?tab=discussions`
 * still works — that's what those comment links carry.
 */
export default function AnimePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070709]" />}>
      <AnimePageInner />
    </Suspense>
  );
}

function AnimePageInner() {
  const params = useParams();
  const sp = useSearchParams();
  const malId = Number(params.id);

  const [anime, setAnime] = useState<Anime | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!malId) { setFailed(true); return; }
    let live = true;
    (async () => {
      // The same triple fallback the old page used: Jikan → Kitsu → AniList.
      let a: Anime | null = null;
      try { a = await getAnimeDetails(malId); }
      catch {
        try { a = await getAnimeDetailsKitsu(malId); }
        catch {
          try { a = await getAnimeDetailsAniList(malId); } catch { /* dead id */ }
        }
      }
      if (!live) return;
      if (a) setAnime(a); else setFailed(true);
    })();
    return () => { live = false; };
  }, [malId]);

  if (failed) {
    return (
      <div className="min-h-screen bg-[#070709] pt-32 text-center">
        <p className="font-mono text-base font-black text-white">Couldn&apos;t load this anime</p>
        <p className="mt-2 font-mono text-xs text-slate-500">The id may be wrong, or the metadata sources are down.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 font-mono text-sm font-bold text-slate-200 transition hover:bg-white/10">
          Back to home
        </Link>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#070709]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709]">
      <AnimeDetailView
        anime={anime}
        options={sp.get("tab") === "discussions" ? { startTab: "discussions" } : undefined}
      />
    </div>
  );
}
