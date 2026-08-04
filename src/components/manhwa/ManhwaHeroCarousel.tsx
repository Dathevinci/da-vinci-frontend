"use client";

import { useRouter } from "next/navigation";
import DeckHero, { DeckItem } from "@/components/ui/DeckHero";
import { IMangaResult } from "@/lib/asura/models";

/**
 * The manhwa home's featured deck — the same fanned-cards hero as the
 * anime home, dealt with AsuraScans covers. Thin wrapper: all the deck
 * physics live in DeckHero.
 *
 * Covers MUST go through the image proxy — AsuraScans hotlink-protects
 * them, so a raw URL renders a broken card.
 */
export default function ManhwaHeroCarousel({ items }: { items: IMangaResult[] }) {
  const router = useRouter();

  const deckItems: DeckItem[] = (items || []).map((m) => ({
    key: m.id,
    title: m.title,
    image: m.image ? `/api/manhwa-image?url=${encodeURIComponent(m.image)}` : null,
    chips: [
      "Manhwa",
      ...(m.rating ? [`★ ${m.rating}`] : []),
      ...(m.status ? [String(m.status)] : []),
      ...(m.latestChapter ? [m.latestChapter] : []),
    ],
    // straight to the series page — popups are retired
    onOpen: () => router.push(`/manhwa/${encodeURIComponent(m.id)}`),
  }));

  return (
    <DeckHero
      items={deckItems}
      primaryLabel="Read Now"
      onPrimary={(item) => {
        router.push(`/manhwa/${encodeURIComponent(item.key)}`);
      }}
      browseHref="/manhwa?view=all&page=1"
      browseLabel="Browse Comics"
    />
  );
}
