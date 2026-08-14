import { NextResponse } from 'next/server';
import { browseNovels, searchAll } from '@/lib/novel/sources';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const list = searchParams.get('list') || '';
    const genre = searchParams.get('genre') || '';
    const status = searchParams.get('status') || '';
    const sort = searchParams.get('sort') || '';

    const data = query
      ? await searchAll(query, page)
      : await browseNovels({ page, list, genre, status, sort });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Novel API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
