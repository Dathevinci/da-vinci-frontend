import { NextResponse } from 'next/server';
import { asuraGenres } from '@/lib/manhwa/sources';

const DEFAULT_GENRES = [
  { id: 1, name: "Action", slug: "action" },
  { id: 2, name: "Adventure", slug: "adventure" },
  { id: 3, name: "Comedy", slug: "comedy" },
  { id: 4, name: "Drama", slug: "drama" },
  { id: 5, name: "Fantasy", slug: "fantasy" },
  { id: 6, name: "Martial Arts", slug: "martial-arts" },
  { id: 7, name: "Murim", slug: "murim" },
  { id: 8, name: "Mystery", slug: "mystery" },
  { id: 9, name: "Psychological", slug: "psychological" },
  { id: 10, name: "Reincarnation", slug: "reincarnation" },
  { id: 11, name: "Romance", slug: "romance" },
  { id: 12, name: "School Life", slug: "school-life" },
  { id: 13, name: "Sci-Fi", slug: "sci-fi" },
  { id: 14, name: "Slice of Life", slug: "slice-of-life" },
  { id: 15, name: "Supernatural", slug: "supernatural" },
  { id: 16, name: "Isekai", slug: "isekai" },
  { id: 17, name: "Historical", slug: "historical" },
  { id: 18, name: "Magic", slug: "magic" },
  { id: 19, name: "Shounen", slug: "shounen" },
  { id: 20, name: "Sports", slug: "sports" },
];

let cache: { data: { id: number; name: string; slug: string }[]; at: number } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > 3600_000) {
      const live = await asuraGenres();
      cache = { data: live && live.length > 0 ? live : DEFAULT_GENRES, at: Date.now() };
    }
    return NextResponse.json(
      { genres: cache.data },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch {
    return NextResponse.json({ genres: DEFAULT_GENRES }, { status: 200 });
  }
}
