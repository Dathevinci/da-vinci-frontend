import { NextResponse } from 'next/server';
import { manhwaHome } from '@/lib/manhwa/sources';

export async function GET() {
  try {
    // Trending + latest, merged across AsuraScans + MangaDex.
    const { trending, latestUpdates } = await manhwaHome();
    return NextResponse.json({ trending, latestUpdates });
  } catch (error: any) {
    console.error('Manhwa Home API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
