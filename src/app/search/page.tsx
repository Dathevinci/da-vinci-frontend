import { searchAnime } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import { Search as SearchIcon, Filter } from "lucide-react";

export const revalidate = 3600;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || undefined;
  const status = resolvedParams.status || undefined; // RELEASING, NOT_YET_RELEASED, FINISHED
  const season = resolvedParams.season || undefined; // WINTER, SPRING, SUMMER, FALL
  
  // AniList variables
  const variables: any = { page: 1 };
  if (query) variables.search = query;
  if (status) variables.status = status;
  if (season) variables.season = season;

  const results = await searchAnime(variables);
  const media = results.Page.media;

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row gap-4 items-center">
          <form className="relative w-full max-w-2xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input 
              name="q"
              defaultValue={query}
              placeholder="Search anime by title..." 
              className="w-full bg-white/5 border border-white/10 text-white text-xl py-4 pl-14 pr-4 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition shadow-inner"
            />
            {status && <input type="hidden" name="status" value={status} />}
          </form>

          {/* Dummy visual filters - In a real app these would be functional selects linking to ?status=X */}
          <div className="flex gap-2 w-full md:w-auto">
            <a href="/search?status=RELEASING" className={`px-4 py-3 rounded-lg border font-bold text-sm flex-1 md:flex-none text-center transition ${status === 'RELEASING' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>
              Airing
            </a>
            <a href="/search?status=NOT_YET_RELEASED" className={`px-4 py-3 rounded-lg border font-bold text-sm flex-1 md:flex-none text-center transition ${status === 'NOT_YET_RELEASED' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>
              Upcoming
            </a>
            <a href="/search?status=FINISHED" className={`px-4 py-3 rounded-lg border font-bold text-sm flex-1 md:flex-none text-center transition ${status === 'FINISHED' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>
              Finished
            </a>
          </div>
        </div>

        {query && (
          <h2 className="text-2xl text-slate-400 mb-6 font-bold flex items-center gap-2">
            Results for <span className="text-white">"{query}"</span>
          </h2>
        )}
        
        {!query && status && (
          <h2 className="text-2xl text-slate-400 mb-6 font-bold flex items-center gap-2">
            Browsing: <span className="text-white">{status.replace(/_/g, ' ')}</span>
          </h2>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {media.map(anime => (
            <div key={anime.id} className="w-full flex justify-center">
              <AnimeCard anime={anime} />
            </div>
          ))}
        </div>
        
        {media.length === 0 && (
          <div className="py-20 text-center text-slate-400 text-lg bg-white/5 rounded-2xl border border-white/10">
            No anime found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
