import { NextResponse } from 'next/server';
import { Hianime } from 'hianime';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const episode = parseInt(searchParams.get('episode') || '1');

  if (!title) {
    return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });
  }

  try {
    const hianime = new Hianime();
    
    // 1. Search for the anime to get its Zoro ID
    const searchRes = await hianime.search(title);
    if (!searchRes.animes || searchRes.animes.length === 0) {
      return NextResponse.json({ success: false, message: 'Anime not found on Hianime' }, { status: 404 });
    }

    // Take the first result (usually the most relevant)
    const zoroId = searchRes.animes[0].id;

    // 2. Fetch the episodes
    const episodes = await hianime.getEpisodes(zoroId);
    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ success: false, message: 'No episodes found for this anime' }, { status: 404 });
    }

    // 3. Find the target episode
    // Hianime episodes are usually listed in order, but sometimes episode numbering can be weird.
    // We'll just take the episode at index (episode - 1).
    const targetEpisode = episodes[episode - 1];
    if (!targetEpisode) {
      return NextResponse.json({ success: false, message: `Episode ${episode} not found` }, { status: 404 });
    }

    // 4. Fetch the servers for this episode
    const servers = await hianime.getEpisodeServers(targetEpisode.id);
    
    // We prefer sub over dub by default
    let targetServer = null;
    if (servers.sub && servers.sub.length > 0) {
      targetServer = servers.sub[0];
    } else if (servers.dub && servers.dub.length > 0) {
      targetServer = servers.dub[0];
    } else if (servers.raw && servers.raw.length > 0) {
      targetServer = servers.raw[0];
    }

    if (!targetServer) {
      return NextResponse.json({ success: false, message: 'No servers found for this episode' }, { status: 404 });
    }

    // 5. Fetch the actual streaming sources (M3U8)
    const sources = await hianime.getEpisodeSources(targetEpisode.id, targetServer.serverId);
    
    return NextResponse.json({
      success: true,
      data: sources
    });

  } catch (error: any) {
    console.error("Hianime API Error:", error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
