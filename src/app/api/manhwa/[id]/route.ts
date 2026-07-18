import { NextResponse } from 'next/server';
import { AsuraScans } from '@/lib/asura';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const asura = new AsuraScans();
    // decode id since it might contain URL-encoded characters
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.id);
    const data = await asura.fetchMangaInfo(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('AsuraScans API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
