import { NextResponse } from 'next/server';
import { AsuraScans } from '@/lib/asura';

export async function GET() {
  try {
    const asura = new AsuraScans();
    const [popular, latest] = await Promise.all([
      asura.getPopularToday(),
      asura.getLatestUpdates(1)
    ]);

    return NextResponse.json({
      trending: popular.results || [],
      latestUpdates: latest.results || [],
    });
  } catch (error: any) {
    console.error('AsuraScans Home API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
