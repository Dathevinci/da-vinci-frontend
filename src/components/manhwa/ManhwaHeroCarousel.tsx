"use client";

import DeckHero, { DeckItem } from "@/components/ui/DeckHero";
import { useManhwaModal } from "@/components/providers/ManhwaModalProvider";
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
  const { openManhwa } = useManhwaModal();

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
    onOpen: () => openManhwa(m),
  }));

  return (
    <DeckHero
      items={deckItems}
      primaryLabel="Read Now"
      onPrimary={(item) => {
        const src = (items || []).find((m) => m.id === item.key);
        if (src) openManhwa(src);
      }}
      browseHref="/manhwa?view=all&page=1"
      browseLabel="Browse Comics"
    />
  );
}
