"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { NovelResult } from "@/lib/novel/ReadNovelFull";
import NovelQuickViewModal from "@/components/ui/NovelQuickViewModal";

interface NovelModalContextValue {
  openNovel: (novel: NovelResult | { id: string }) => void;
  closeNovel: () => void;
}

const NovelModalContext = createContext<NovelModalContextValue>({
  openNovel: () => {},
  closeNovel: () => {},
});

export const useNovelModal = () => useContext(NovelModalContext);

export default function NovelModalProvider({ children }: { children: React.ReactNode }) {
  const [novel, setNovel] = useState<NovelResult | { id: string } | null>(null);

  const openNovel = useCallback((n: NovelResult | { id: string }) => setNovel(n), []);
  const closeNovel = useCallback(() => setNovel(null), []);

  return (
    <NovelModalContext.Provider value={{ openNovel, closeNovel }}>
      {children}
      {novel && <NovelQuickViewModal key={novel.id} novel={novel} onClose={closeNovel} />}
    </NovelModalContext.Provider>
  );
}
