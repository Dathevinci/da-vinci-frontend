"use client";

import DeckHero, { DeckItem } from "@/components/ui/DeckHero";
import { useNovelModal } from "@/components/providers/NovelModalProvider";
import { novelCover } from "@/lib/novelImage";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";

/**
 * The novel library's featured deck — same fanned-cards hero as the anime
 * and manhwa homes. Thin wrapper: all the deck physics live in DeckHero.
 *
 * Covers go through novelCover() (proxy/upscaler); never render the raw
 * source URL.
 */
export default function NovelHeroCarousel({ items }: { items: NovelResult[] }) {
  const { openNovel } = useNovelModal();

  const deckItems: DeckItem[] = (items || []).map((n) => ({
    key: n.id,
    title: n.title,
    image: novelCover(n.cover),
    chips: [
      "Light Novel",
      ...(n.latestChapter ? [n.latestChapter] : []),
    ],
    onOpen: () => openNovel(n),
  }));

  return (
    <DeckHero
      items={deckItems}
      primaryLabel="Read Now"
      onPrimary={(item) => {
        const src = (items || []).find((n) => n.id === item.key);
        if (src) openNovel(src);
      }}
      browseHref="/novel?view=all&page=1"
      browseLabel="Browse Library"
    />
  );
}
