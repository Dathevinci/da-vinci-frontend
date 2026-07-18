"use client";

import { useState, useEffect } from "react";
import ManhwaCard from "@/components/manhwa/ManhwaCard";
import ManhwaFilters from "@/components/manhwa/ManhwaFilters";
import ManhwaHeroCarousel from "@/components/manhwa/ManhwaHeroCarousel";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookMarked, Loader2, Flame, Clock, Star } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { IMangaResult, ISearch } from "@/lib/asura/models";
import { formatDistanceToNowStrict } from "date-fns";

export default function ManhwaPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const query = sp.get("q") || "";

  const [data, setData] = useState<IMangaResult[]>([]);
  const [trending, setTrending] = useState<IMangaResult[]>([]);
  const [latestUpdates, setLatestUpdates] = useState<IMangaResult[]>([]);
  
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [popularTab, setPopularTab] = useState<"weekly" | "monthly" | "allTime">("weekly");

  const isHome = !query && page === 1 && sp.get("view") !== "all";

  useEffect(() => {
    setLoading(true);
    
    if (isHome) {
      // Fetch home layout data (Trending & Latest)
      fetch('/api/manhwa/home')
        .then((res) => res.json())
        .then((res) => {
          setTrending(res.trending || []);
          setLatestUpdates(res.latestUpdates || []);
          setHasNext(true); // Assuming home always has a next page
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else {
      // Fetch regular search/pagination data
      let url = `/api/manhwa?page=${page}`;
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }
      fetch(url)
        .then((res) => res.json())
        .then((res: ISearch<IMangaResult>) => {
          setData(res.results || []);
          setHasNext(res.hasNextPage || false);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setData([]);
          setHasNext(false);
          setLoading(false);
        });
    }
  }, [sp.toString(), isHome]);

  const buildUrl = (p: number) => {
    const u = new URLSearchParams(sp.toString());
    u.set("page", String(p));
    if (!isHome && !query) u.set("view", "all");
    return `/manhwa?${u.toString()}`;
  };

  const getPopularItems = () => {
    if (!trending || trending.length === 0) return [];
    if (popularTab === "monthly") return [...trending].reverse().slice(0, 10);
    if (popularTab === "allTime") return [...trending].sort((a,b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, 10);
    return trending.slice(0, 10);
  };

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-16 pb-16 text-white font-sans selection:bg-indigo-500/30">
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-[#a3a3a3] text-sm font-bold uppercase tracking-widest">Loading AsuraScans...</p>
        </div>
      ) : isHome ? (
        <>
          {/* Top Hero Carousel */}
          <ManhwaHeroCarousel items={trending.slice(0, 10)} />
          
          <div className="max-w-[1300px] mx-auto px-4 md:px-8">
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Main Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-8">
                
                {/* Trending Comics Section */}
                <div className="bg-[#151518] rounded-xl border border-[#2a2a32] p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#2a2a32]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[#8a2be2]/20 flex items-center justify-center shadow-[0_0_10px_rgba(138,43,226,0.2)]">
                        <Star className="w-4 h-4 text-[#8a2be2] fill-[#8a2be2]" />
                      </div>
                      <h2 className="text-[1.3rem] font-black text-white tracking-wide">Trending Comics</h2>
                    <button onClick={() => router.push("/manhwa?view=all&page=1")} className="px-4 py-1.5 bg-[#8a2be2] hover:bg-[#9a3bf2] text-white text-xs font-bold rounded transition-colors shadow-md">
                      All Comics
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                    {latestUpdates.slice(0, 5).map((manhwa) => (
                      <ManhwaCard key={manhwa.id} manhwa={manhwa} />
                    ))}
                  </div>
                </div>

                {/* Latest Updates Section */}
                <div className="bg-[#151518] rounded-xl border border-[#2a2a32] p-5 shadow-lg">
                  <div className="flex items-center mb-6 pb-3 border-b border-[#2a2a32]">
                    <h2 className="text-[1.3rem] font-black text-white tracking-wide">Latest Updates</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {latestUpdates.map((manhwa) => (
                      <div key={`latest-${manhwa.id}`} className="flex gap-4 p-3 bg-[#0b0b0c] rounded-lg border border-[#2a2a32] hover:border-[#8a2be2]/50 transition-colors">
                        <Link href={`/manhwa/${encodeURIComponent(manhwa.id)}`} className="w-[85px] h-[120px] shrink-0 rounded overflow-hidden shadow-md">
                          {manhwa.image && (
                            <img src={manhwa.image} alt={manhwa.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                          )}
                        </Link>
                        <div className="flex flex-col flex-1 min-w-0">
                          <Link href={`/manhwa/${encodeURIComponent(manhwa.id)}`} className="text-sm font-bold text-[#e2e8f0] line-clamp-2 hover:text-[#8a2be2] transition-colors mb-2 leading-snug">
                            {manhwa.title}
                          </Link>
                          
                          <div className="flex flex-col gap-1.5 mt-auto">
                            {(manhwa.latest_chapters && manhwa.latest_chapters.length > 0) ? (
                              manhwa.latest_chapters.slice(0, 3).map((chapter, offset) => {
                                const timeText = formatDistanceToNowStrict(new Date(chapter.published_at), { addSuffix: true });
                                return (
                                  <div key={chapter.id} className="flex items-center justify-between text-[11px]">
                                    <Link href={`/manhwa/${encodeURIComponent(manhwa.id)}#chapter-${chapter.number}`} className={`font-bold transition-colors hover:text-[#8a2be2] visited:text-[#8a2be2] flex items-center gap-1 ${offset === 0 ? 'text-[#ffc107]' : 'text-[#e2e8f0]'}`}>
                                      Chapter {chapter.number} {chapter.is_premium && <span className="text-[9px]">🔒</span>}
                                    </Link>
                                    <span className={`font-medium ${offset === 0 ? 'text-[#ffc107]/80' : 'text-[#737373]'}`}>
                                      {timeText}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              [0, 1, 2].map((offset) => {
                                const latestNumStr = (manhwa.latestChapter || "10").replace(/[^0-9]/g, "");
                                const latestNum = parseInt(latestNumStr) || 10;
                                const chNum = latestNum - offset;
                                if (chNum <= 0) return null;
                                
                                const timeText = offset === 0 ? "3h 9m ago" : offset === 1 ? "1 week ago" : "2 weeks ago";
                                
                                return (
                                  <div key={`fallback-${offset}`} className="flex items-center justify-between text-[11px]">
                                    <Link href={`/manhwa/${encodeURIComponent(manhwa.id)}#chapter-${chNum}`} className={`font-bold transition-colors hover:text-[#8a2be2] visited:text-[#8a2be2] flex items-center gap-1 ${offset === 0 ? 'text-[#ffc107]' : 'text-[#e2e8f0]'}`}>
                                      Chapter {chNum}
                                    </Link>
                                    <span className={`font-medium ${offset === 0 ? 'text-[#ffc107]/80' : 'text-[#737373]'}`}>
                                      {timeText}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar: Popular */}
              <div className="w-full lg:w-[360px] shrink-0">
                <div className="bg-[#151518] rounded-xl border border-[#2a2a32] p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#2a2a32]">
                    <h2 className="text-[1.3rem] font-bold text-white">Popular</h2>
                    <div className="flex items-center gap-1 bg-[#0b0b0c] p-1 rounded border border-[#2a2a32]">
                      <button 
                        onClick={() => setPopularTab("weekly")}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${popularTab === 'weekly' ? 'bg-[#8a2be2] text-white shadow' : 'text-[#a3a3a3] hover:text-white'}`}
                      >
                        Weekly
                      </button>
                      <button 
                        onClick={() => setPopularTab("monthly")}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${popularTab === 'monthly' ? 'bg-[#8a2be2] text-white shadow' : 'text-[#a3a3a3] hover:text-white'}`}
                      >
                        Monthly
                      </button>
                      <button 
                        onClick={() => setPopularTab("allTime")}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${popularTab === 'allTime' ? 'bg-[#8a2be2] text-white shadow' : 'text-[#a3a3a3] hover:text-white'}`}
                      >
                        All Time
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {getPopularItems().map((item, index) => (
                      <Link 
                        key={`${popularTab}-${item.id}`} 
                        href={`/manhwa/${encodeURIComponent(item.id)}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden border border-[#2a2a32] bg-[#0b0b0c]">
                          {item.image && (
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute top-0 left-0 w-5 h-5 bg-[#8a2be2] text-white text-[10px] font-bold flex items-center justify-center rounded-br shadow-md">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex flex-col pt-1 min-w-0">
                          <h4 className="text-sm font-bold text-[#e2e8f0] line-clamp-1 leading-tight group-hover:text-[#8a2be2] transition-colors">
                            {item.title}
                          </h4>
                          <div className="text-[10px] font-bold text-[#737373] mt-1 line-clamp-1">
                            Genres: Action, Adventure, Fantasy
                          </div>
                          {item.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex text-yellow-500 text-[9px]">★★★★★</div>
                              <div className="text-[#a3a3a3] text-[9px] font-bold">{item.rating}</div>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      ) : data.length > 0 ? (
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 bg-[#151518] border border-[#2a2a32] p-6 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8a2be2] to-purple-600"></div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-[#8a2be2]/10 flex items-center justify-center text-[#8a2be2] border border-[#8a2be2]/20">
                  <BookMarked className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm">Manhwa</h1>
                  <p className="text-[#a3a3a3] text-xs font-bold uppercase tracking-widest mt-1">
                    Powered by AsuraScans
                  </p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-auto md:min-w-[320px]">
              <ManhwaFilters />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6 border-b border-[#2a2a32] pb-3">
            <BookMarked className="w-5 h-5 text-[#8a2be2]" />
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              {query ? `Search: ${query}` : `Browse Series`}
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {data.map((manhwa) => (
              <ManhwaCard key={manhwa.id} manhwa={manhwa} />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="py-32 text-center flex flex-col items-center bg-[#151518] rounded-2xl border border-[#2a2a32] shadow-xl">
            <span className="text-6xl mb-4 opacity-50">📖</span>
            <h3 className="text-2xl font-black text-white mb-2">No Series Found</h3>
            <p className="text-[#a3a3a3] text-sm font-medium max-w-md">Try adjusting your search query.</p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && (isHome ? latestUpdates.length > 0 : data.length > 0) && (
        <div className="mt-16 flex justify-center items-center gap-4 text-xs font-bold uppercase tracking-widest">
          {page > 1 ? (
            <Link href={buildUrl(page - 1)} className="px-6 py-3 bg-[#151518] hover:bg-[#1e1e24] border border-[#2a2a32] rounded-lg transition flex items-center gap-2 shadow-md text-white">
              <ChevronLeft className="w-4 h-4" /> Prev
            </Link>
          ) : (
            <span className="px-6 py-3 bg-[#151518]/50 border border-[#2a2a32]/50 rounded-lg opacity-40 cursor-not-allowed flex items-center gap-2 text-[#737373]">
              <ChevronLeft className="w-4 h-4" /> Prev
            </span>
          )}
          
          <span className="px-6 py-3 bg-[#0b0b0c] border border-[#2a2a32] rounded-lg text-[#a3a3a3] shadow-inner">
            Page {page}
          </span>
          
          {hasNext ? (
            <Link href={buildUrl(page + 1)} className="px-6 py-3 bg-[#8a2be2] hover:bg-[#9a3bf2] text-white border border-[#8a2be2]/50 rounded-lg transition shadow-[0_0_15px_rgba(138,43,226,0.2)] flex items-center gap-2">
              Next <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <span className="px-6 py-3 bg-[#151518]/50 border border-[#2a2a32]/50 rounded-lg opacity-40 cursor-not-allowed flex items-center gap-2 text-[#737373]">
              Next <ChevronRight className="w-4 h-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
