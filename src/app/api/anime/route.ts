import { NextResponse } from "next/server";
import { searchAnime } from "@/lib/jikan";

/**
 * GET /api/anime?q=<term>&page=1
 *
 * A thin HTTP face on searchAnime(), which until now was server-only.
 *
 * Anime search lives in lib/jikan and talks to AniList's GraphQL API directly,
 * so a SERVER component could call it and a CLIENT component could not. Manhwa
 * and novel both already had a route (/api/manhwa, /api/novels), which is why
 * every client-side feature that searches a catalogue — the Hidden Gems vote
 * sheet being the one that prompted this — worked in two modes out of three.
 *
 * The response is deliberately shaped like the other two: `{ results: [...] }`
 * with `id`, `title` and `image`. Callers branch on mode enough already; the
 * envelope is the one thing they should not have to.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Number(searchParams.get("page")) || 1;

    // A blank query would return AniList's default listing, which reads as
    // "here are some anime" in a box the user just typed nothing into.
    if (q.length < 2) return NextResponse.json({ results: [] });

    const data: any = await searchAnime({ search: q, page });
    const media: any[] = data?.Page?.media || [];

    return NextResponse.json({
      results: media.map((m) => ({
        id: String(m.mal_id ?? m.id),
        title: typeof m.title === 'string' ? m.title : (m.title?.english || m.title?.romaji || m.title?.userPreferred || "Untitled"),
        // The Anime object is mapped by mapAniListMedia, so images are under m.images.jpg
        image: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || null,
      })),
    });
  } catch (error: any) {
    console.error("Anime search API error:", error);
    // An empty list rather than a 500: the vote sheet treats a failed search
    // and a search with no matches identically, and a thrown error there would
    // surface as a dead box with no explanation.
    return NextResponse.json({ results: [] });
  }
}
