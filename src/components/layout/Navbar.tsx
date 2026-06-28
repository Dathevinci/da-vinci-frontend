import Link from 'next/link';
import { Search, Compass, Calendar, Activity } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 transition-all duration-300 bg-gradient-to-b from-[#09090b]/90 to-transparent backdrop-blur-sm border-b border-white/5">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-3xl font-black text-white tracking-tighter flex items-center gap-3 drop-shadow-md">
            <img src="/logo.jpg" alt="Da Vinci Logo" className="w-10 h-10 object-cover rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/20" />
            Da <span className="text-indigo-500">Vinci</span>
          </Link>
          <nav className="hidden lg:flex gap-6 font-medium text-sm text-slate-300">
            <Link href="/" className="hover:text-white hover:text-indigo-400 transition">Dashboard</Link>
            <Link href="/search?status=RELEASING" className="hover:text-white hover:text-indigo-400 transition">Airing Now</Link>
            <Link href="/search?status=NOT_YET_RELEASED" className="hover:text-white hover:text-indigo-400 transition">Upcoming</Link>
            <Link href="/calendar" className="hover:text-white hover:text-indigo-400 transition">Calendar</Link>
          </nav>
        </div>
        <div className="flex items-center gap-6 text-slate-200">
          <Link href="/search" className="hover:text-white transition flex items-center gap-2">
            <Search className="w-5 h-5" />
            <span className="hidden md:inline text-sm font-medium">Search</span>
          </Link>
          <Link href="/profile">
            <div className="px-4 py-2 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold text-sm hover:bg-indigo-600/40 transition shadow-lg cursor-pointer flex items-center gap-2">
              <Compass className="w-4 h-4" />
              My Tracker
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
