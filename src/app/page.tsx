import { getDashboardData } from "@/lib/anilist";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeStatusBadge from "@/components/anime/AnimeStatusBadge";
import AnnouncementBanner from "@/components/ui/AnnouncementBanner";
import CommunityFeed from "@/components/community/CommunityFeed";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import { Info, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";

// Revalidate dashboard every hour
export const revalidate = 3600;

export default async function Home() {
  const data = await getDashboardData();
  const heroAnime = data.trending.media[0];
  
  const heroTitle = heroAnime?.title.english || heroAnime?.title.romaji || heroAnime?.title.userPreferred;
  const heroBanner = heroAnime?.bannerImage || heroAnime?.coverImage.extraLarge;
  const nextEp = heroAnime?.nextAiringEpisode;

  return (
    <div className="pb-20 min-h-screen bg-black/40 backdrop-blur-sm">
      {/* Cinematic Dashboard Hero */}
      <HeroBannerCarousel animes={data.trending.media.slice(0, 5)} />

      <AnnouncementBanner />

      {/* Carousels */}
      <div className="relative z-20 space-y-4">
        <AnimeCarousel title="Currently Airing" animes={data.airingNow.media} />
        <AnimeCarousel title="Upcoming Next Season" animes={data.nextSeason.media} />
        <AnimeCarousel title="Trending This Season" animes={data.thisSeason.media} />
        <AnimeCarousel title="Highly Anticipated" animes={data.upcoming.media} />
        <AnimeCarousel title="Recently Finished" animes={data.finished.media} />
      </div>

      {/* Community Discussion Feed */}
      <CommunityFeed />
    </div>
  );
}
