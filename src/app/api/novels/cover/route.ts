import { NextResponse } from 'next/server';
import { getNovelCover } from '@/lib/anilist';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    if (!title) return NextResponse.json({ cover: null });

    const cover = await getNovelCover(title);
    return NextResponse.json({ cover });
  } catch (error: any) {
    return NextResponse.json({ cover: null });
  }
}
