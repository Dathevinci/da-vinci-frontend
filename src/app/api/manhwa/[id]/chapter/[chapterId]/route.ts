import { NextResponse } from 'next/server';
import { getChapterPagesRescued } from '@/lib/manhwa/sources';

// The rescue path stacks primary retries + a 12s donor budget; the platform
// default window can kill the invocation mid-donor, which also loses the
// donor-cache write that would have absorbed the outage for the next click.
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  try {
    const resolvedParams = await params;
    const decodedId = decodeURIComponent(resolvedParams.chapterId);
    // The chapter id carries its own source: "vtx:<slug>|<chapter>",
    // "mna:<slug>|<chapter>", or a bare "<slug>|<n>" for Asura. A chapter
    // locked on its own source may come back rescued from a donor.
    const result = await getChapterPagesRescued(decodedId);
    /**
     * The body stays the bare pages ARRAY — the reader (and any long-open tab
     * running older code) does `setPages(data)` on it, so the rescue metadata
     * rides response headers instead of changing the shape under them.
     */
    const res = NextResponse.json(result.pages);
    if (result.rescuedFrom) res.headers.set('x-dv-rescued-from', result.rescuedFrom);
    if (result.lockedOn) res.headers.set('x-dv-locked-on', result.lockedOn);
    if (result.unlockTime) res.headers.set('x-dv-unlock-time', result.unlockTime);
    if (result.donorsChecked) res.headers.set('x-dv-donors-checked', '1');
    return res;
  } catch (error: any) {
    console.error('Manhwa Chapter API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
