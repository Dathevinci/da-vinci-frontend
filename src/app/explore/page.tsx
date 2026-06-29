import { searchAnime } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import ExploreFilters from "@/components/explore/ExploreFilters";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || undefined;
  const status = resolvedParams.status || undefined;
  const season = resolvedParams.season || undefined;
  const genre = resolvedParams.genre || undefined;
  const sort = resolvedParams.sort || undefined;
  const format = resolvedParams.format || undefined;
  const page = parseInt(resolvedParams.page || "1");
  
  // AniList variables
  const variables: any = { page };
  if (query) variables.search = query;
  if (status) variables.status = status;
  if (season) variables.season = season;
  if (genre) variables.genre_in = genre.split(",");
  if (sort) variables.sort = [sort];
  if (format) variables.format = format;

  const results = await searchAnime(variables);
  const media = results.Page.media;
  const pageInfo = results.Page.pageInfo;

  // Build pagination links
  const createPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (season) params.set("season", season);
    if (genre) params.set("genre", genre);
    if (sort) params.set("sort", sort);
    if (format) params.set("format", format);
    params.set("page", newPage.toString());
    return `/explore?${params.toString()}`;
  };

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-8 text-white">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar Filters */}
        <ExploreFilters />

        {/* Main Content Grid */}
        <div className="flex-1">
          <div className="mb-6 flex justify-between items-end border-b border-white/10 pb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">Explore Anime</h1>
              <p className="text-slate-400 mt-1">{pageInfo.total} results found</p>
            </div>
            
            <div className="hidden sm:flex gap-2 text-sm font-bold">
              {page > 1 && (
                <Link href={createPageUrl(page - 1)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Link>
              )}
              {pageInfo.hasNextPage && (
                <Link href={createPageUrl(page + 1)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-lg transition shadow-lg flex items-center gap-1 text-white">
                  Next <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
            {media.map(anime => (
              <div key={anime.id} className="w-full flex justify-center">
                <AnimeCard anime={anime} />
              </div>
            ))}
          </div>
          
          {media.length === 0 && (
            <div className="py-32 text-center flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/10 mt-8">
              <span className="text-6xl mb-4">🛸</span>
              <h3 className="text-2xl font-bold text-white mb-2">No results found</h3>
              <p className="text-slate-400 max-w-md">Try adjusting your filters, selecting fewer genres, or searching for a different title.</p>
            </div>
          )}

          {/* Bottom Pagination */}
          {media.length > 0 && (
            <div className="mt-12 flex justify-center gap-4 text-sm font-bold">
              {page > 1 ? (
                <Link href={createPageUrl(page - 1)} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" /> Previous Page
                </Link>
              ) : (
                <button disabled className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl opacity-50 cursor-not-allowed flex items-center gap-2">
                  <ChevronLeft className="w-5 h-5" /> Previous Page
                </button>
              )}
              
              <div className="flex items-center justify-center px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300">
                Page {page}
              </div>

              {pageInfo.hasNextPage ? (
                <Link href={createPageUrl(page + 1)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 rounded-xl transition shadow-lg flex items-center gap-2 text-white">
                  Next Page <ChevronRight className="w-5 h-5" />
                </Link>
              ) : (
                <button disabled className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl opacity-50 cursor-not-allowed flex items-center gap-2">
                  Next Page <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
