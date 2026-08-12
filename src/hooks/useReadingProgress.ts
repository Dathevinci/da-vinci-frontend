"use client";

import { useEffect, useState } from "react";
import { readLocalProgress, PROGRESS_EVENT, type ReadingKind } from "@/lib/readingProgress";

/**
 * The chapter this reader is on, for a single title.
 *
 * Reads the local cache on mount (instant, and correct offline or signed out),
 * then re-reads whenever a reconcile against the server changes it — which is
 * what makes a laptop pick up what the phone read without a manual refresh.
 * The reconcile itself lives in useManhwaStatus / useNovelStatus, which already
 * fetch the bookmark list, so this hook costs NO extra request.
 *
 * Returns null until mounted, so server render and first paint agree.
 */
export function useReadingProgress(kind: ReadingKind, id: string): string | null {
  const [chapterId, setChapterId] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setChapterId(readLocalProgress(kind, id)?.chapterId ?? null);
    load();
    // PROGRESS_EVENT covers this tab; "storage" covers a second tab of the same
    // browser reading a different chapter.
    window.addEventListener(PROGRESS_EVENT, load);
    window.addEventListener("storage", load);
    /**
     * The cache is namespaced per account, and signing in or out is a state
     * update rather than a reload — so without this, a "Continue" button would
     * go on showing the PREVIOUS namespace's chapter until something else
     * happened to fire a progress event. Re-reading on the account broadcast
     * makes the switch immediate: the new account sees its own place, or none.
     */
    window.addEventListener("davinci_user_updated", load);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, load);
      window.removeEventListener("storage", load);
      window.removeEventListener("davinci_user_updated", load);
    };
  }, [kind, id]);

  return chapterId;
}
