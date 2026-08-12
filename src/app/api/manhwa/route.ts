import { NextResponse } from 'next/server';
import { searchManhwa, browseManhwa } from '@/lib/manhwa/sources';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const genre = searchParams.get('genre') || undefined;
    const filters = { status, sort, genre };

    // Merges AsuraScans + FlameComics + RizzComics + MangaPill (any of them
    // being down still returns the rest — see sources.ts).
    const data = query ? await searchManhwa(query, page, filters) : await browseManhwa(page, filters);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Manhwa API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
