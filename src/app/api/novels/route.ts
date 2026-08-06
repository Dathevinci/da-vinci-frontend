import { NextResponse } from 'next/server';
import { browseNovels, searchAll } from '@/lib/novel/sources';
import * as Lnori from '@/lib/novel/Lnori';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const list = searchParams.get('list') || 'most-popular-novel';
    const source = searchParams.get('source');

    // Lnori is a flat catalogue rather than a set of ranked lists, so it has
    // its own browse path instead of pretending to honour `list`. Its search is
    // a filter over the cached listing, which is why it does not go through
    // searchAll with the scraping sources.
    if (source === 'lnori') {
      const data = query ? await Lnori.searchNovels(query, page) : await Lnori.browseNovels(page);
      return NextResponse.json(data);
    }

    const data = query ? await searchAll(query, page) : await browseNovels(page, list);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('ReadNovelFull API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
