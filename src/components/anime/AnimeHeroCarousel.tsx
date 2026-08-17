"use client";

import { useRouter } from "next/navigation";
import DeckHero, { DeckItem } from "@/components/ui/DeckHero";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * The anime home's featured deck — the same fanned-cards hero the manhwa and
 * novel homes use, dealt with AniList art.
 *
 * Anime kept the older HeroBannerCarousel while the other two modes moved to
 * DeckHero, so the three home pages opened with two different heroes and the
 * site felt like two products. All the deck physics live in DeckHero; this is
 * only a mapper, exactly like its manhwa and novel twins.
 *
 * No image proxy here, unlike manhwa: AniList serves its covers directly and
 * does not hotlink-protect them.
 */
export default function AnimeHeroCarousel({ animes }: { animes: any[] }) {
  const router = useRouter();
  // Data Saver drops the hero to AniList's `large` cover tier — the deck's
  // full-viewport background is the anime home's single biggest image cost,
  // and `large` is already fetched as the fallback so no query changes. With
  // the toggle OFF the tier order is exactly what it always was.
  const { preferences } = usePreferences();
  const coverOf = (a: any) =>
    preferences.dataSaver
      ? a.coverImage?.large || a.coverImage?.extraLarge
      : a.coverImage?.extraLarge || a.coverImage?.large;

  const href = (a: any) => `/anime/${encodeURIComponent(String(a.mal_id ?? a.id))}`;

  const deckItems: DeckItem[] = (animes || []).map((a) => ({
    key: String(a.mal_id ?? a.id),
    title: a.title?.english || a.title?.romaji || a.title?.userPreferred || a.title || "Untitled",
    // bannerImage is a wide still and reads badly in a portrait card, so the
    // cover is preferred and the banner is only a last resort.
    image:
      coverOf(a) ||
      a.images?.jpg?.large_image_url ||
      a.images?.jpg?.image_url ||
      a.bannerImage ||
      null,
    chips: [
      "Anime",
      // AniList scores are out of 100; the other modes show a 10-point star, so
      // this is divided to match rather than showing "★ 84" beside "★ 8.4".
      ...(a.averageScore ? [`★ ${(a.averageScore / 10).toFixed(1)}`] : a.score ? [`★ ${a.score}`] : []),
      ...(a.episodes ? [`${a.episodes} eps`] : []),
      ...(a.status ? [String(a.status).replace(/_/g, " ").toLowerCase()] : []),
    ],
    onOpen: () => router.push(href(a)),
  }));

  return (
    <DeckHero
      items={deckItems}
      primaryLabel="Watch Now"
      onPrimary={(item) => {
        router.push(`/anime/${encodeURIComponent(item.key)}`);
      }}
      browseHref="/explore"
      browseLabel="Browse Anime"
    />
  );
}
