import { NextResponse } from 'next/server';
import { browseNovels, searchNovels } from '@/lib/novel/ReadNovelFull';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const list = searchParams.get('list') || 'most-popular-novel';

    const data = query ? await searchNovels(query) : await browseNovels(page, list);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('ReadNovelFull API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
