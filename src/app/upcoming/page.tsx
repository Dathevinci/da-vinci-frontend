import { searchAnime } from "@/lib/jikan";
import HeroBannerCarousel from "@/components/anime/HeroBannerCarousel";
import AnimatedGrid from "@/components/ui/AnimatedGrid";
import PageTransition from "@/components/layout/PageTransition";
import { AlertTriangle } from "lucide-react";

export const revalidate = 3600;

export default async function UpcomingPage() {
  let animes: any[] = [];
  try {
    const data = await searchAnime({ status: "upcoming", page: 1 });
    animes = data?.Page?.media || [];
  } catch (err) {
    console.error("Upcoming API Error:", err);
  }

  if (!animes || animes.length === 0) {
    return (
      <div className="min-h-screen pt-40 pb-20 px-4 flex flex-col items-center justify-center bg-[#09090b] text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-black text-white mb-4">Database Offline</h1>
        <p className="text-slate-400 max-w-md mx-auto text-lg">
          The primary AniList API is currently experiencing severe stability issues and has been disabled by its developers.
        </p>
        <p className="text-slate-500 max-w-md mx-auto mt-4">
          We are actively monitoring the situation and your service will automatically resume the moment their servers are back online. Thank you for your patience!
        </p>
      </div>
    );
  }

  const heroAnimes = animes.slice(0, 5);
  const gridAnimes = animes.slice(5);

  return (
    <PageTransition>
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
    </PageTransition>
  );
}
