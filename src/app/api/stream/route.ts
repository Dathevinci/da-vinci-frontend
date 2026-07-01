import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://anitaku.pe';
const AJAX_URL = 'https://ajax.gogo-load.com';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing anime query" }, { status: 400 });
    }

    // 1. Search for the anime
    const searchRes = await fetch(`${BASE_URL}/search.html?keyword=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!searchRes.ok) throw new Error("Search failed");
    
    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);
    
    // Get first result category link
    const firstLink = $search('.items li .name a').first().attr('href');
    if (!firstLink) {
      return NextResponse.json({ error: "Anime not found on stream provider." }, { status: 404 });
    }

    // 2. Fetch category page to get the movie ID
    const catRes = await fetch(`${BASE_URL}${firstLink}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const catHtml = await catRes.text();
    const $cat = cheerio.load(catHtml);
    
    const animeId = $cat('input#movie_id').val();
    if (!animeId) {
      throw new Error("Could not extract internal anime ID");
    }

    // 3. Fetch episodes list (we just want the first episode for demonstration)
    const epListRes = await fetch(`${AJAX_URL}/ajax/load-list-episode?ep_start=0&ep_end=1&id=${animeId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const epListHtml = await epListRes.text();
    const $epList = cheerio.load(epListHtml);
    
    // The episode list is sorted descending or ascending depending on the anime. 
    // Usually the last <li> is episode 1.
    const firstEpLink = $epList('li a').last().attr('href');
    
    if (!firstEpLink) {
      throw new Error("No episodes found");
    }

    // 4. Fetch the episode page to get the iframe
    const epUrl = `${BASE_URL}${firstEpLink.trim()}`;
    const epRes = await fetch(epUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);
    
    // Extract video iframes (multiple servers)
    const sources: string[] = [];
    $ep('.anime_muti_link ul li a').each((i, el) => {
      const src = $ep(el).attr('data-video');
      if (src) {
        // Some sources start with //
        const fullSrc = src.startsWith('//') ? `https:${src}` : src;
        sources.push(fullSrc);
      }
    });

    if (sources.length === 0) {
      // Fallback: check direct iframe
      const fallbackIframe = $ep('.play-video iframe').attr('src');
      if (fallbackIframe) {
        sources.push(fallbackIframe.startsWith('//') ? `https:${fallbackIframe}` : fallbackIframe);
      }
    }

    if (sources.length === 0) {
      throw new Error("Failed to extract video players");
    }

    // Return the items in a format that the existing VideoPlayer component understands 
    // (since it heuristically extracts links)
    return NextResponse.json({ success: true, results: sources.map(url => ({ iframe: url })) });

  } catch (error: any) {
    console.error("Free Streaming API Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred while scraping the stream." }, { status: 500 });
  }
}
