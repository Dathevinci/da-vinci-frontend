import { NextResponse } from 'next/server';
import { getManhwaInfo } from '@/lib/manhwa/sources';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // decode id since it might contain URL-encoded characters
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.id);
    // Routes by id prefix: "mdx:" → MangaDex, bare slug → AsuraScans.
    const data = await getManhwaInfo(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Manhwa Info API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
