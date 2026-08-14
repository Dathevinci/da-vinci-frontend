import type { NovelResult, NovelInfo, ChapterContent } from "./types";

export function resolveSource(id: string) {
  return { source: null, slug: id };
}

export function getSourceName(id: string): string {
  return "Novel Engine (In Progress)";
}

export async function getNovelInfo(id: string): Promise<NovelInfo> {
  return {
    id,
    novelId: id,
    title: "Rebuilding Novel Library",
    cover: "",
    author: "Da Vinci Studio",
    status: "In Progress",
    genres: ["Reconstruction", "Fresh Start"],
    synopsis: "The novel reader and source catalog are currently being rebuilt from scratch.",
    chapters: []
  };
}

export async function getChapterContent(id: string, chapterId: string): Promise<ChapterContent> {
  return {
    title: "In Progress",
    content: ["The novel library is currently undergoing a complete rebuild from scratch. Please check back soon!"],
    prev: null,
    next: null
  };
}

export async function searchAll(query: string, page = 1) {
  return { results: [], hasNextPage: false };
}

export async function browseNovels(page = 1, list = "trending") {
  return { results: [], hasNextPage: false, totalPages: 1 };
}

export async function homeShelves() {
  return {
    featuredHero: [],
    lightNovels: [],
    koreanMasterpieces: [],
    cultivationEpics: [],
    trending: [],
    latestUpdates: [],
    completed: [],
    lnwTop: [],
    nfTop: [],
  };
}
