import { NextResponse } from 'next/server';
import { AsuraScans } from '@/lib/asura';

export async function GET(request: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const asura = new AsuraScans();
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.chapterId);
    const data = await asura.fetchChapterPages(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AsuraScans API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
