import { Quote } from "lucide-react";

const quotes = [
  { text: "Whatever you lose, you'll find it again. But what you throw away you'll never get back.", character: "Kenshin Himura", anime: "Rurouni Kenshin" },
  { text: "If you don't take risks, you can't create a future.", character: "Monkey D. Luffy", anime: "One Piece" },
  { text: "A lesson without pain is meaningless. For you cannot gain something without sacrificing something else in return.", character: "Edward Elric", anime: "Fullmetal Alchemist: Brotherhood" },
  { text: "People, who can't throw something important away, can never hope to change anything.", character: "Armin Arlert", anime: "Attack on Titan" },
  { text: "The world isn't perfect. But it's there for us, doing the best it can... that's what makes it so damn beautiful.", character: "Roy Mustang", anime: "Fullmetal Alchemist: Brotherhood" },
  { text: "Knowing you're different is only the beginning. If you accept these differences you'll be able to get past them and grow even closer.", character: "Miss Kobayashi", anime: "Miss Kobayashi's Dragon Maid" },
  { text: "Fear is not evil. It tells you what your weakness is. And once you know your weakness, you can become stronger.", character: "Gildarts Clive", anime: "Fairy Tail" },
  { text: "I must study lots of things or I won't become a great person.", character: "Kotomi Ichinose", anime: "Clannad" },
  { text: "Hard work is worthless for those that don't believe in themselves.", character: "Naruto Uzumaki", anime: "Naruto" },
  { text: "If you just submit yourself to fate, then that's the end of it.", character: "Keiichi Maebara", anime: "Higurashi: When They Cry" },
  { text: "Even if I'm weak, even if I have no power, I'll fight!", character: "Subaru Natsuki", anime: "Re:Zero" },
  { text: "You can't sit around envying other people's worlds. You have to go out and change your own.", character: "Shinichi Chiaki", anime: "Nodame Cantabile" }
];

export default function QuoteOfTheDay() {
  // Use the current day of the year to pick a "daily" quote so it stays the same all day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
  const quote = quotes[dayOfYear % quotes.length];

  return (
    <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-12 mt-6">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex items-center justify-between shadow-2xl">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <Quote className="w-48 h-48 -mr-12 text-indigo-500" />
        </div>
        
        <div className="relative z-10 flex gap-4 items-start">
          <div className="bg-indigo-500/10 p-3 rounded-full hidden sm:block">
            <Quote className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Message of the Day
            </h4>
            <p className="text-white md:text-lg font-medium leading-relaxed italic mb-3">"{quote.text}"</p>
            <p className="text-slate-400 text-sm">
              <span className="text-white font-bold">{quote.character}</span> &mdash; {quote.anime}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
