import { NextRequest, NextResponse } from "next/server";
import { getManhwaBanner } from "@/lib/anilist";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ banner: null });
  }

  try {
    const banner = await getManhwaBanner(title);
    return NextResponse.json(
      { banner },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        },
      }
    );
  } catch {
    return NextResponse.json({ banner: null });
  }
}
