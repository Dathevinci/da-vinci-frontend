import { NextResponse } from 'next/server';
import { getNovelInfo } from '@/lib/novel/sources';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getNovelInfo(decodeURIComponent(id));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('ReadNovelFull API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
