"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { IMangaResult } from "@/lib/asura/models";
import ManhwaQuickViewModal from "@/components/ui/ManhwaQuickViewModal";

export interface ManhwaModalOptions {
  startChapter?: string;
}

interface ManhwaModalContextValue {
  openManhwa: (manhwa: IMangaResult | { id: string }, options?: ManhwaModalOptions) => void;
  closeManhwa: () => void;
}

const ManhwaModalContext = createContext<ManhwaModalContextValue>({
  openManhwa: () => {},
  closeManhwa: () => {},
});

export const useManhwaModal = () => useContext(ManhwaModalContext);

function ManhwaModalUrlWatcher({ onOpen }: { onOpen: (m: IMangaResult | { id: string }, opts?: ManhwaModalOptions) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const view = searchParams.get("mview");
    if (!view) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === view) return;
    handledRef.current = view;

    (async () => {
      try {
        onOpen({ id: view });
      } catch (e) {
        /* ignore */
      }
      
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.delete("mview");
      const qs = sp.toString();
      router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
    })();
  }, [searchParams, onOpen, router, pathname]);

  return null;
}

export default function ManhwaModalProvider({ children }: { children: React.ReactNode }) {
  const [manhwa, setManhwa] = useState<IMangaResult | { id: string } | null>(null);
  const [options, setOptions] = useState<ManhwaModalOptions | undefined>();

  const openManhwa = useCallback((m: IMangaResult | { id: string }, opts?: ManhwaModalOptions) => {
    setManhwa(m);
    setOptions(opts);
  }, []);
  
  const closeManhwa = useCallback(() => {
    setManhwa(null);
    setOptions(undefined);
  }, []);

  return (
    <ManhwaModalContext.Provider value={{ openManhwa, closeManhwa }}>
      {children}

      <Suspense fallback={null}>
        <ManhwaModalUrlWatcher onOpen={openManhwa} />
      </Suspense>

      {manhwa && (
        <ManhwaQuickViewModal
          key={manhwa.id}
          manhwa={manhwa}
          options={options}
          onClose={closeManhwa}
        />
      )}
    </ManhwaModalContext.Provider>
  );
}
