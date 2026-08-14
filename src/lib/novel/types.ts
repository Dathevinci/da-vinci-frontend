export interface NovelResult {
  id: string;
  title: string;
  cover: string;
  latestChapter?: string;
  rating?: string;
  views?: string;
  tag?: string;
  score?: number | null;
  banner?: string | null;
  description?: string;
}

export interface NovelChapter {
  id: string;
  number: number;
  title: string;
  releaseDate?: string;
}

export interface NovelInfo {
  id: string;
  novelId: string;
  title: string;
  cover: string;
  bannerImage?: string | null;
  score?: number | null;
  author: string;
  status: string;
  genres: string[];
  synopsis: string;
  chapters: NovelChapter[];
  alternativeServers?: { source: string; id: string; name: string }[];
}

export interface ChapterContent {
  title: string;
  content: string[];
  prev: string | null;
  next: string | null;
}
