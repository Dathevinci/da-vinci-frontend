"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Info, Clapperboard, Star, MessagesSquare, ChevronRight } from "lucide-react";
import { Anime } from "@tutkli/jikan-ts";

import TrackerButton from "@/components/anime/TrackerButton";
import { useAnimeModal, type AnimeModalOptions } from "@/components/providers/AnimeModalProvider";
import {
  getAnimeDetails, getAnimeCharacters, getAnimeRecommendations,
  getAnimeRelations, getYouTubeId, type AnimeRelation,
} from "@/lib/jikan";
import { getAnimeDetailsKitsu } from "@/lib/kitsu";
import EpisodeList from "@/components/anime/EpisodeList";
import CommunityFeed from "@/components/community/CommunityFeed";

/**
 * THE ANIME DETAIL SCREEN — poster-first hero over the show's own blurred
 * art, mono title, chips, one white Watch Now, then a tabbed Details block.
 *
 * ONE body, TWO homes: the QuickViewModal overlay (opened from cards,
 * search, the deck hero, profiles) and the /anime/[id] route (where
 * community and profile comment links land). They used to be two different
 * designs, so the same show looked like two different sites depending on
 * how you arrived.
 */

type Tab = "overview" | "episodes" | "trailer" | "discussions" | "morelike";

const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: "overview", label: "Overview", Icon: Info },
  { key: "episodes", label: "Episodes", Icon: Play },
  { key: "trailer", label: "Trailer", Icon: Clapperboard },
  { key: "discussions", label: "Discussions", Icon: MessagesSquare },
  { key: "morelike", label: "More Like This", Icon: Star },
];

/** Relation badge tint — sequels/prequels get the green treatment. */
function relTint(rel: string): string {
  const r = rel.toLowerCase();
  if (r.includes("sequel") || r.includes("prequel")) return "#34d399";
  return "#94a3b8";
}

export default function AnimeDetailView({
  anime,
  options,
}: {
  anime: Anime;
  options?: AnimeModalOptions;
}) {
  const [cast, setCast] = useState<string[]>([]);
  const [fullAnime, setFullAnime] = useState<Anime | null>(anime);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [relations, setRelations] = useState<AnimeRelation[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(
    options?.startTab === "discussions" ? "discussions" : options?.autoPlay ? "episodes" : "overview"
  );
  // Watch Now arms EpisodeList's autoplay — the same prop ContinueWatching
  // has always driven; the button just flips it on after mount too.
  const [watchNow, setWatchNow] = useState(!!options?.autoPlay);
  const detailsRef = useRef<HTMLDivElement>(null);

  const { openAnime } = useAnimeModal();

  // Hydrate partial anime objects (community chips pass just an id+title).
  useEffect(() => {
    let isMounted = true;
    const loadFull = async () => {
      if (anime.trailer && anime.synopsis) { setFullAnime(anime); return; }
      try {
        const full = await getAnimeDetails(anime.mal_id);
        if (isMounted) setFullAnime(full);
      } catch (err) {
        console.error("Failed to load full anime details:", err);
        try {
          const kitsuFull = await getAnimeDetailsKitsu(anime.mal_id);
          if (isMounted) setFullAnime(kitsuFull);
        } catch (kitsuErr) {
          console.error("Kitsu fallback also failed:", kitsuErr);
        }
      }
    };
    loadFull();
    return () => { isMounted = false; };
  }, [anime]);

  // Characters ride with the hydration burst; recommendations and relations
  // wait a beat. Four simultaneous calls tripped Jikan's 3/sec limit and the
  // 429 retry could land on the POSTER fetch — the hero stayed empty while
  // two below-the-fold sections loaded first.
  useEffect(() => {
    let isMounted = true;
    getAnimeCharacters(anime.mal_id).then((c) => { if (isMounted) setCast(c); }).catch(() => {});
    const t = setTimeout(() => {
      if (!isMounted) return;
      getAnimeRecommendations(anime.mal_id).then((r) => { if (isMounted) setRecommendations(r); }).catch(() => {});
      getAnimeRelations(anime.mal_id).then((r) => { if (isMounted) setRelations(r); }).catch(() => {});
    }, 1400);
    return () => { isMounted = false; clearTimeout(t); };
  }, [anime]);

  const displayAnime = fullAnime || anime;
  const title = displayAnime?.title_english || displayAnime?.title || "";
  const posterUrl = displayAnime?.images?.jpg?.large_image_url || displayAnime?.images?.jpg?.image_url;
  const bannerUrl = displayAnime?.trailer?.images?.maximum_image_url || posterUrl;
  const youtubeId = displayAnime ? getYouTubeId(displayAnime.trailer) : null;
  const statusLabel = displayAnime?.status
    ? displayAnime.status.toLowerCase().includes("finished") ? "Finished"
      : displayAnime.status.toLowerCase().includes("airing") ? "Airing" : displayAnime.status
    : null;

  const openRelated = (r: AnimeRelation) => {
    openAnime({
      mal_id: r.mal_id,
      title: r.name,
      images: { jpg: { image_url: "", large_image_url: "" }, webp: { image_url: "", large_image_url: "" } },
      url: "",
    } as unknown as Anime);
  };

  return (
    <>
      {/* ═══ HERO — poster first, over the show's own blurred art ═══ */}
      <div className="relative overflow-hidden">
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#070709]/60 to-[#070709]" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-10 pt-16 text-center sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-44 shrink-0 overflow-hidden rounded-xl sm:w-56"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.14), 0 30px 80px rgba(0,0,0,.8)" }}
          >
            {posterUrl && <img src={posterUrl} alt={title} className="aspect-[2/3] w-full object-cover" />}
          </motion.div>

          {/* meta chips */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] font-black uppercase tracking-wide"
          >
            {displayAnime.score ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-amber-300">
                <Star className="h-3 w-3 fill-current" /> {(displayAnime.score * 10).toFixed(0)}%
              </span>
            ) : null}
            {displayAnime.year ? <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{displayAnime.year}</span> : null}
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{displayAnime.type || "TV"}</span>
            <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">
              {displayAnime.episodes ? `${displayAnime.episodes} Episodes` : "Ongoing"}
            </span>
            {statusLabel && <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-slate-300">{statusLabel}</span>}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-3xl font-mono text-3xl font-black uppercase tracking-wider text-white sm:text-4xl md:text-5xl"
          >
            {title}
          </motion.h1>

          {(displayAnime.genres?.length || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              {displayAnime.genres!.slice(0, 5).map((g) => (
                <span key={g.name} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-xs font-bold text-slate-200">
                  {g.name}
                </span>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={() => {
                setActiveTab("episodes");
                setWatchNow(true);
                detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-2.5 rounded-xl bg-white px-7 py-3 font-mono text-sm font-black text-black transition hover:bg-white/85"
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={0} />
              Watch Now
            </button>
            <TrackerButton anime={displayAnime} variant="full" />
          </motion.div>
        </div>
      </div>

      {/* ═══ DETAILS ═══ */}
      <div ref={detailsRef} className="mx-auto max-w-5xl scroll-mt-6 px-4 pb-28 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b0b11]">
          <div className="px-5 pt-6 sm:px-7">
            <h2 className="font-mono text-2xl font-black text-white">Details</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">Explore more about {title}</p>
          </div>

          {/* tab bar */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 px-3 sm:px-5">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => {
                  // Leaving Episodes DISARMS autoplay. EpisodeList unmounts
                  // per tab, wiping its own has-played guard — with the arm
                  // still set, every return to Episodes re-fired it.
                  if (key !== "episodes") setWatchNow(false);
                  setActiveTab(key);
                }}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 font-mono text-xs font-bold transition-colors ${
                  activeTab === key
                    ? "border-white text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="px-5 py-7 sm:px-7">
            {activeTab === "overview" && (
              <div className="space-y-8">
                {relations.length > 0 && (
                  <div>
                    <p className="mb-3 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Related Anime</p>
                    <div className="flex flex-col gap-1.5">
                      {relations.map((r) => (
                        <button
                          key={`${r.relation}-${r.mal_id}`}
                          onClick={() => openRelated(r)}
                          className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-mono text-sm text-slate-200">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-slate-300" />
                            <span className="truncate">{r.name}</span>
                          </span>
                          <span
                            className="shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-black uppercase"
                            style={{ color: relTint(r.relation), borderColor: `${relTint(r.relation)}55`, background: `${relTint(r.relation)}12` }}
                          >
                            {r.relation}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-white/10 py-6 sm:grid-cols-4">
                  {[
                    ["Format", displayAnime.type || "—"],
                    ["Episodes", displayAnime.episodes ? String(displayAnime.episodes) : "—"],
                    ["Duration", displayAnime.duration ? displayAnime.duration.replace(" per ep", "") : "—"],
                    ["Score", displayAnime.score ? `${(displayAnime.score * 10).toFixed(0)}%` : "—"],
                    ["Status", statusLabel || "—"],
                    ["Studio", displayAnime.studios?.[0]?.name || "—"],
                    ["Source", displayAnime.source || "—"],
                    ["Season", displayAnime.season ? `${displayAnime.season[0].toUpperCase()}${displayAnime.season.slice(1)} ${displayAnime.year || ""}` : displayAnime.year ? String(displayAnime.year) : "—"],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{k}</p>
                      <p className="mt-1 font-mono text-sm font-bold text-white">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="font-mono text-sm leading-relaxed text-slate-300">
                  {displayAnime.synopsis
                    ? displayAnime.synopsis.split("\n\n").map((para, pi) => (
                        <p key={pi} className={pi > 0 ? "mt-4" : ""}>{para}</p>
                      ))
                    : <p className="italic text-slate-500">No synopsis available.</p>}
                </div>

                {cast.length > 0 && (
                  <p className="font-mono text-xs text-slate-500">
                    Cast: <span className="text-slate-300">{cast.join(", ")}</span><span className="italic">, more</span>
                  </p>
                )}
              </div>
            )}

            {activeTab === "episodes" && (
              <EpisodeList
                anime={displayAnime}
                autoPlayProp={watchNow}
                autoPlayEpProp={options?.startEpisode}
                resumeSecondsProp={options?.startSeconds}
              />
            )}

            {activeTab === "trailer" && (
              youtubeId ? (
                <div className="max-w-2xl">
                  <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                      title={`${title} trailer`}
                    />
                  </div>
                  <p className="mt-3 font-mono text-sm font-bold text-white">Official Trailer</p>
                </div>
              ) : (
                <p className="font-mono text-sm italic text-slate-500">No trailer available for this anime.</p>
              )
            )}

            {activeTab === "discussions" && (
              <CommunityFeed
                animeId={displayAnime.mal_id}
                animeTitle={displayAnime.title_english || displayAnime.title}
              />
            )}

            {activeTab === "morelike" && (
              recommendations.length > 0 ? (
                <div>
                  <h3 className="mb-5 font-mono text-lg font-black text-white">Recommended Anime</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {recommendations.map((rec) => (
                      <button
                        key={rec.mal_id}
                        type="button"
                        onClick={() => openAnime(rec)}
                        className="group text-left"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[#101018]">
                          <img
                            src={(rec.images?.jpg?.large_image_url || rec.images?.jpg?.image_url || "") as string}
                            alt={rec.title_english || rec.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                            <p className="line-clamp-1 font-mono text-sm font-black text-white">{rec.title_english || rec.title}</p>
                            <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Anime{rec.score ? ` • ${(rec.score * 10).toFixed(0)}%` : ""}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-mono text-sm italic text-slate-500">No recommendations yet.</p>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
