import { getCalendarData } from "@/lib/jikan";

import AnimeModalTrigger from "@/components/anime/AnimeModalTrigger";
import { Clock, AlertTriangle } from "lucide-react";

export const revalidate = 300;

export default async function CalendarPage() {
  let animes: any[] = [];
  try {
    animes = await getCalendarData();
  } catch (err) {
    console.error("Calendar API Error:", err);
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

  // Group by day of week
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const grouped: Record<string, any[]> = {};
  
  animes.forEach(anime => {
    let dayName = "Unknown";
    if (anime._airingAt) {
      // airingAt is a unix timestamp in seconds
      const date = new Date(anime._airingAt * 1000);
      dayName = days[date.getDay()];
    } else if (anime.broadcast?.day) {
      dayName = anime.broadcast.day;
    }

    if (dayName !== "Unknown") {
      if (!grouped[dayName]) grouped[dayName] = [];
      grouped[dayName].push(anime);
    }
  });

  // Since Jikan provides the day names with an 's' (e.g. Sundays), we'll map today
  const todayDate = new Date();
  const dayIndex = todayDate.getDay();
  const sortedDays = [...days.slice(dayIndex), ...days.slice(0, dayIndex)];

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3 text-purple-400">
          Airing Calendar
        </h1>
        <p className="text-slate-400 mb-10">Estimated release schedule for this season (JST).</p>

        <div className="space-y-12">
          {sortedDays.map(day => {
            const dayAnimes = grouped[day] || [];
            if (dayAnimes.length === 0) return null;

            return (
              <div key={day} className="bg-white/5 border border-white/5 rounded-2xl p-6">
                <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">
                  {day === days[dayIndex] ? "Today" : 
                   day === days[(dayIndex - 1 + 7) % 7] ? "Yesterday" : 
                   day === days[(dayIndex + 1) % 7] ? "Tomorrow" : day}
                   <span className="text-slate-500 text-lg ml-2 font-medium">({day})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayAnimes.map(anime => {
                    const title = anime.title_english || anime.title;
                    let timeString = anime.broadcast?.time || "Unknown Time";
                    if (anime._airingAt) {
                      const date = new Date(anime._airingAt * 1000);
                      timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    
                    return (
                      <AnimeModalTrigger anime={anime} key={anime.mal_id} className="w-full text-left">
                        <div className="flex items-center gap-4 bg-[#141414] border border-white/5 p-3 rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition group cursor-pointer">
                          <img src={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url} alt={title} className="w-16 h-24 object-cover rounded shadow-md" />
                          <div>
                            <h3 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-purple-400 transition">{title}</h3>
                            <div className="text-xs text-purple-300 font-semibold mb-1">
                              {anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing'}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeString} (JST)
                            </div>
                          </div>
                        </div>
                      </AnimeModalTrigger>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
