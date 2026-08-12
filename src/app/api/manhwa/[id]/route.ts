import { NextResponse } from 'next/server';
import { getManhwaInfo } from '@/lib/manhwa/sources';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // decode id since it might contain URL-encoded characters
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.id);
    // Routes by id prefix ("flc:", "rzc:", "mpl:", "mrd:"); a bare slug is
    // AsuraScans. An unknown prefix throws a named error rather than being
    // guessed at, and lands in the catch below as a legible message.
    const data = await getManhwaInfo(decodedId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Manhwa Info API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
