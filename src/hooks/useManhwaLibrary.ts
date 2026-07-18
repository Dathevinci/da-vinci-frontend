"use client";

import { useState, useEffect } from "react";

export type ManhwaStatus = "Reading" | "Finished" | "PlanToRead" | "Dropped" | "None";

export interface LibraryManhwa {
  id: string;
  title: string;
  coverUrl: string | null;
  status: ManhwaStatus;
  lastReadChapterId?: string;
  lastReadChapterNum?: string;
  addedAt: number;
}

// Global in-memory store (same pattern as useAnimeStatus)
let globalLibrary: Record<string, LibraryManhwa> = {};
let isLoaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem("davinci_manhwa", JSON.stringify(globalLibrary));
  } catch {}
}

function load() {
  if (isLoaded) return;
  try {
    const raw = localStorage.getItem("davinci_manhwa");
    if (raw) globalLibrary = JSON.parse(raw);
  } catch {}
  isLoaded = true;
}

export function useManhwaLibrary() {
  const [library, setLibrary] = useState<Record<string, LibraryManhwa>>(globalLibrary);
  const [loaded, setLoaded] = useState(isLoaded);

  useEffect(() => {
    load();
    setLibrary({ ...globalLibrary });
    setLoaded(true);

    const handleChange = () => {
      setLibrary({ ...globalLibrary });
      setLoaded(true);
    };
    listeners.add(handleChange);
    return () => { listeners.delete(handleChange); };
  }, []);

  const getStatus = (id: string): ManhwaStatus =>
    library[id]?.status || "None";

  const setStatus = (
    manhwa: { id: string; title: string; coverUrl: string | null },
    status: ManhwaStatus
  ) => {
    if (status === "None") {
      delete globalLibrary[manhwa.id];
    } else {
      globalLibrary[manhwa.id] = {
        ...globalLibrary[manhwa.id],
        id: manhwa.id,
        title: manhwa.title,
        coverUrl: manhwa.coverUrl,
        status,
        addedAt: globalLibrary[manhwa.id]?.addedAt || Date.now(),
      };
    }
    persist();
    emit();
  };

  const saveProgress = (id: string, chapterId: string, chapterNum: string) => {
    if (!globalLibrary[id]) return;
    globalLibrary[id].lastReadChapterId = chapterId;
    globalLibrary[id].lastReadChapterNum = chapterNum;
    persist();
    emit();
  };

  const isInLibrary = (id: string) => (library[id]?.status || "None") !== "None";

  const getLibraryList = (filterStatus?: ManhwaStatus): LibraryManhwa[] => {
    const all = Object.values(library).sort((a, b) => b.addedAt - a.addedAt);
    return filterStatus ? all.filter((m) => m.status === filterStatus) : all;
  };

  return { library, getStatus, setStatus, saveProgress, isInLibrary, getLibraryList, loaded };
}
