import { NextResponse } from 'next/server';
import { getChapterPages } from '@/lib/manhwa/sources';

export async function GET(request: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.chapterId);
    // The chapter id carries its own source: "flc:<id>|<token>",
    // "rzc:<chapter-slug>", "mpl:<id>/<slug>", or a bare "<slug>|<n>" for Asura.
    const data = await getChapterPages(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Manhwa Chapter API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
