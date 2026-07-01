import { NextResponse } from 'next/server';

// This is the URL of your local anipy-server
const ANIPY_URL = process.env.ANIPY_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing anime query" }, { status: 400 });
    }

    // 1. Search for the anime on your local anipy-server
    const searchRes = await fetch(`${ANIPY_URL}/anime/search?q=${encodeURIComponent(query)}`);
    if (!searchRes.ok) {
      throw new Error("Failed to connect to anipy-server. Make sure it is running on port 8000!");
    }
    
    const searchData = await searchRes.json();
    
    // anipy-server search returns an array or an object with results
    const results = Array.isArray(searchData) ? searchData : searchData.results;
    if (!results || results.length === 0) {
      return NextResponse.json({ error: "Anime not found on anipy-server." }, { status: 404 });
    }

    const animeId = results[0].id; // Get the ID of the first result

    // 2. Fetch the streaming links for Episode 1
    const epRes = await fetch(`${ANIPY_URL}/anime/${animeId}/1`);
    if (!epRes.ok) {
      throw new Error(`Failed to fetch episode 1 for ${animeId}`);
    }

    const epData = await epRes.json();
    
    // epData contains stream URLs or an iframe. We will pass this to the VideoPlayer
    // which intelligently extracts the playable links.
    return NextResponse.json({ success: true, results: [epData] });

  } catch (error: any) {
    console.error("Anipy-Server Error:", error);
    return NextResponse.json({ 
      error: error.message || "Could not fetch stream. Ensure 'anipy' is running." 
    }, { status: 500 });
  }
}
