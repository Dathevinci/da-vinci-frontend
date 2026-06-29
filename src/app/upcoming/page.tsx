import { searchAnime } from "@/lib/anilist";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import AnimatedGrid from "@/components/ui/AnimatedGrid";

export const dynamic = 'force-dynamic';

export default async function UpcomingPage() {
  const data = await searchAnime({ status: "NOT_YET_RELEASED", sort: "POPULARITY_DESC", page: 1 });
  const animes = data.Page.media;

  if (!animes || animes.length === 0) {
    return <div className="min-h-screen pt-32 text-center text-white">No data found.</div>;
  }

  const heroAnimes = animes.slice(0, 5);
  const gridAnimes = animes.slice(5);

  return (
    <div className="pb-20 min-h-screen bg-black/40 backdrop-blur-sm">
      <HeroBannerCarousel animes={heroAnimes} />
      
      <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-12 mt-12">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-4xl font-black text-white drop-shadow-lg">Highly Anticipated</h1>
          <div className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            UPCOMING
          </div>
        </div>
        <AnimatedGrid animes={gridAnimes} />
      </div>
    </div>
  );
}
