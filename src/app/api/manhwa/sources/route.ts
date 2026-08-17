import { NextResponse } from 'next/server';
import { getAlternativeSources } from '@/lib/manhwa/sources';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || '';
    const currentId = searchParams.get('id') || '';
    if (!title.trim()) {
      return NextResponse.json({ sources: [] });
    }
    const sources = await getAlternativeSources(title, currentId);
    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error('Manhwa Sources API Error:', error);
    return NextResponse.json({ error: error.message, sources: [] }, { status: 500 });
  }
}
