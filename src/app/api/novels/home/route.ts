import { NextResponse } from 'next/server';
import { browseNovels } from '@/lib/novel/ReadNovelFull';

// Home shelves for Novels mode — trending (popular), recently updated, completed.
export async function GET() {
  try {
    const [trending, latest, completed] = await Promise.all([
      browseNovels(1, 'most-popular-novel'),
      browseNovels(1, 'latest-release-novel'),
      browseNovels(1, 'completed-novel'),
    ]);
    return NextResponse.json({
      trending: trending.results || [],
      latestUpdates: latest.results || [],
      completed: completed.results || [],
    });
  } catch (error: any) {
    console.error('Novel Home API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
