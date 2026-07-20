import { NextResponse } from 'next/server';
import { getChapterContent } from '@/lib/novel/ReadNovelFull';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; chapterId: string }> }) {
  try {
    const { id, chapterId } = await params;
    const data = await getChapterContent(decodeURIComponent(id), decodeURIComponent(chapterId));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('ReadNovelFull API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
