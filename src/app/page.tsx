import { getDashboardData } from "@/lib/jikan";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import AnnouncementBanner from "@/components/ui/AnnouncementBanner";
import QuoteOfTheDay from "@/components/ui/QuoteOfTheDay";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import { Info, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";

// Revalidate dashboard every hour
export const dynamic = 'force-dynamic';

export default async function Home() {
  let data = null;
  try {
    data = await getDashboardData();
  } catch (err) {
    console.error("Dashboard API Error:", err);
  }
  
  if (!data) {
    return <div className="min-h-screen pt-32 text-center text-white">Loading data or API is temporarily unavailable...</div>;
  }

  // Shuffle the trending anime for the hero banner so it changes every time
  const shuffledTrending = [...data.trending.media].sort(() => 0.5 - Math.random());
  const heroAnimes = shuffledTrending.slice(0, 5);

  return (
    <div className="pb-20 min-h-screen bg-black/40 backdrop-blur-sm">
      {/* Cinematic Dashboard Hero */}
      <HeroBannerCarousel animes={heroAnimes} />

      <QuoteOfTheDay />
      <AnnouncementBanner />

      {/* Carousels */}
      <div className="relative z-20 space-y-4">
        <AnimeCarousel title="Currently Airing" animes={data.airingNow.media} />
        <AnimeCarousel title="Upcoming Next Season" animes={data.nextSeason.media} />
        <AnimeCarousel title="Trending This Season" animes={data.thisSeason.media} />
        <AnimeCarousel title="Highly Anticipated" animes={data.upcoming.media} />
        <AnimeCarousel title="Recently Finished" animes={data.finished.media} />
      </div>
    </div>
  );
}
