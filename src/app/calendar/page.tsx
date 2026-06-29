import { getCalendarData } from "@/lib/anilist";
import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  let schedules: any[] = [];
  try {
    const data = await getCalendarData();
    schedules = data?.Page?.airingSchedules || [];
  } catch (err) {
    console.error("Calendar API Error:", err);
  }

  // Group by day of week
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const grouped: Record<string, any[]> = {};
  
  schedules.forEach(schedule => {
    const date = new Date(schedule.airingAt * 1000);
    const dayName = days[date.getDay()];
    if (!grouped[dayName]) grouped[dayName] = [];
    grouped[dayName].push(schedule);
  });

  // Reorder grouped keys starting from today
  const todayIdx = new Date().getDay();
  const sortedDays = [...days.slice(todayIdx), ...days.slice(0, todayIdx)];

  return (
    <div className="bg-[#09090b] min-h-screen pt-24 pb-12 px-4 md:px-12 text-white">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3 text-indigo-400">
          Airing Calendar
        </h1>
        <p className="text-slate-400 mb-10">Estimated release schedule for the next 7 days.</p>

        <div className="space-y-12">
          {sortedDays.map(day => {
            const daySchedules = grouped[day] || [];
            if (daySchedules.length === 0) return null;

            return (
              <div key={day} className="bg-white/5 border border-white/5 rounded-2xl p-6">
                <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">{day}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daySchedules.map(sched => {
                    const title = sched.media.title.english || sched.media.title.romaji;
                    const date = new Date(sched.airingAt * 1000);
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <Link href={`/anime/${sched.media.id}`} key={sched.id}>
                        <div className="flex items-center gap-4 bg-[#141414] border border-white/5 p-3 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition group">
                          <img src={sched.media.coverImage.large} alt={title} className="w-16 h-24 object-cover rounded shadow-md" />
                          <div>
                            <h3 className="font-bold text-sm line-clamp-2 mb-1 group-hover:text-indigo-400 transition">{title}</h3>
                            <div className="text-xs text-indigo-300 font-semibold mb-1">Episode {sched.episode}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeString}
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
