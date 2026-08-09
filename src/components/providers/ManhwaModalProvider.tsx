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
  /** Step back to the series this one was opened FROM, if any. */
  backManhwa: () => void;
  canGoBack: boolean;
}

const ManhwaModalContext = createContext<ManhwaModalContextValue>({
  openManhwa: () => {},
  closeManhwa: () => {},
  backManhwa: () => {},
  canGoBack: false,
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
  /**
   * The trail of in-modal hops (a recommendation opening another series), so
   * back returns to the series you were browsing instead of the feed — the
   * twin of the stack in AnimeModalProvider, same reasoning.
   */
  const [stack, setStack] = useState<{ manhwa: IMangaResult | { id: string }; options?: ManhwaModalOptions }[]>([]);

  const manhwaRef = useRef<IMangaResult | { id: string } | null>(null);
  const optionsRef = useRef<ManhwaModalOptions | undefined>(undefined);
  manhwaRef.current = manhwa;
  optionsRef.current = options;

  const openManhwa = useCallback((m: IMangaResult | { id: string }, opts?: ManhwaModalOptions) => {
    const prev = manhwaRef.current;
    if (prev && prev.id !== m.id) {
      setStack((s) => [...s, { manhwa: prev, options: optionsRef.current }].slice(-10));
    }
    setManhwa(m);
    setOptions(opts);
  }, []);

  const closeManhwa = useCallback(() => {
    setManhwa(null);
    setOptions(undefined);
    setStack([]);
  }, []);

  const backManhwa = useCallback(() => {
    setStack((s) => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      setManhwa(last.manhwa);
      setOptions(last.options);
      return s.slice(0, -1);
    });
  }, []);

  return (
    <ManhwaModalContext.Provider value={{ openManhwa, closeManhwa, backManhwa, canGoBack: stack.length > 0 }}>
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
          onBack={stack.length > 0 ? backManhwa : undefined}
        />
      )}
    </ManhwaModalContext.Provider>
  );
}
