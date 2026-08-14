"use client";

import { useRouter } from "next/navigation";
import DeckHero, { DeckItem } from "@/components/ui/DeckHero";
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
  const router = useRouter();

  const deckItems: DeckItem[] = (items || []).map((n) => ({
    key: n.id,
    title: n.title,
    image: novelCover(n.cover),
    chips: [
      (n as any).tag || "Light Novel",
      ...(n.latestChapter ? [n.latestChapter] : []),
    ],
    // straight to the novel page — popups are retired
    onOpen: () => router.push(`/novel/${encodeURIComponent(n.id)}`),
  }));

  return (
    <DeckHero
      items={deckItems}
      primaryLabel="Read Now"
      onPrimary={(item) => {
        router.push(`/novel/${encodeURIComponent(item.key)}`);
      }}
      browseHref="/novel?view=all&page=1"
      browseLabel="Browse Library"
    />
  );
}
