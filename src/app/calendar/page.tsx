import { getCalendarData } from "@/lib/jikan";
import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  let animes: any[] = [];
  try {
    animes = await getCalendarData();
  } catch (err) {
    console.error("Calendar API Error:", err);
  }

  // Group by day of week
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const grouped: Record<string, any[]> = {};
  
  animes.forEach(anime => {
    const dayName = anime.broadcast?.day || "Unknown";
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
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3 text-indigo-400">
          Airing Calendar
        </h1>
        <p className="text-slate-400 mb-10">Estimated release schedule for this season (JST).</p>

        <div className="space-y-12">
          {sortedDays.map(day => {
            const dayAnimes = grouped[day] || [];
            if (dayAnimes.length === 0) return null;

            return (
              <div key={day} className="bg-white/5 border border-white/5 rounded-2xl p-6">
                <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">{day}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayAnimes.map(anime => {
                    const title = anime.title_english || anime.title;
                    const timeString = anime.broadcast?.time || "Unknown Time";
                    
                    return (
                      <Link href={`/anime/${anime.mal_id}`} key={anime.mal_id}>
                        <div className="flex items-center gap-4 bg-[#141414] border border-white/5 p-3 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition group">
                          <img src={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url} alt={title} className="w-16 h-24 object-cover rounded shadow-md" />
                          <div>
                            <h3 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-indigo-400 transition">{title}</h3>
                            <div className="text-xs text-indigo-300 font-semibold mb-1">
                              {anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing'}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeString} (JST)
                            </div>
                          </div>
                        </div>
                      </Link>
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
