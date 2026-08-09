import { NextResponse } from 'next/server';
import { asuraGenres } from '@/lib/manhwa/sources';

/**
 * AsuraScans' genre taxonomy, for the explore filter panel. Fetched from
 * their API rather than hardcoded — genres come and go with their catalog,
 * and a chip for a genre they dropped would filter to nothing.
 *
 * Cached in-process for an hour: the taxonomy changes on the order of months,
 * and the panel opens on the order of seconds.
 */
let cache: { data: { id: number; name: string; slug: string }[]; at: number } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > 3600_000) {
      cache = { data: await asuraGenres(), at: Date.now() };
    }
    return NextResponse.json(
      { genres: cache.data },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
    );
  } catch (error: any) {
    // A failed fetch hides the genre section rather than erroring the panel.
    return NextResponse.json({ genres: [] }, { status: 200 });
  }
}
