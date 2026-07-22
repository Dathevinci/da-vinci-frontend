import { NextResponse } from 'next/server';
import { getChapterPages } from '@/lib/manhwa/sources';

export async function GET(request: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.chapterId);
    // Chapter id carries its source: "mdx:<uuid>" → MangaDex, "<slug>|<n>" → Asura.
    const data = await getChapterPages(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Manhwa Chapter API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
