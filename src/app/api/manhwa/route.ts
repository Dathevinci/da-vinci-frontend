import { NextResponse } from 'next/server';
import { AsuraScans } from '@/lib/asura';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const asura = new AsuraScans();

    let data;
    if (query) {
      data = await asura.search(query, page);
    } else {
      data = await asura.getSeries(page);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AsuraScans API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
