import Link from "next/link";
import { Compass, Code2, MessageCircle, Radio, Heart, ExternalLink, ShieldCheck, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative mt-20 bg-[#09090b] border-t border-white/10 overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          
          {/* Brand Section */}
          <div className="lg:col-span-1 space-y-6">
            <Link href="/" className="flex items-center gap-3 group inline-flex">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-2xl tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-purple-400 transition-all duration-300">
                Da Vinci
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              The ultimate modern dashboard for anime tracking. Syncs seamlessly with AniList API to provide a gorgeous, legally compliant data visualization experience.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-500 hover:border-indigo-500 transition-all duration-300 shadow-lg">
                <Code2 className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-400 hover:border-blue-400 transition-all duration-300 shadow-lg">
                <MessageCircle className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-600 transition-all duration-300 shadow-lg">
                <Radio className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 tracking-wide">Navigation</h4>
            <ul className="space-y-3 text-slate-400 font-medium">
              <li>
                <Link href="/" className="hover:text-indigo-400 hover:pl-2 transition-all duration-300 inline-flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 opacity-0 transition-opacity"></span>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-indigo-400 hover:pl-2 transition-all duration-300 inline-flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 opacity-0 transition-opacity"></span>
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="hover:text-indigo-400 hover:pl-2 transition-all duration-300 inline-flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 opacity-0 transition-opacity"></span>
                  Airing Calendar
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-indigo-400 hover:pl-2 transition-all duration-300 inline-flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-indigo-500 opacity-0 transition-opacity"></span>
                  Community
                </Link>
              </li>
            </ul>
          </div>

          {/* Data Sources */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 tracking-wide">Data Sources</h4>
            <ul className="space-y-3 text-slate-400 font-medium">
              <li>
                <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="group hover:text-purple-400 transition-all duration-300 inline-flex items-center gap-2">
                  AniList GraphQL API
                  <ExternalLink className="w-3 h-3 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                </a>
              </li>
              <li>
                <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer" className="group hover:text-purple-400 transition-all duration-300 inline-flex items-center gap-2">
                  Jikan API (MyAnimeList)
                  <ExternalLink className="w-3 h-3 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                </a>
              </li>
              <li>
                <a href="https://github.com/AniList/ApiV2-GraphQL-Docs" target="_blank" rel="noopener noreferrer" className="group hover:text-purple-400 transition-all duration-300 inline-flex items-center gap-2">
                  Developer Docs
                  <ExternalLink className="w-3 h-3 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal / Contact */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 tracking-wide">Legal</h4>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Da Vinci is strictly an educational tracker interface. We do not host, scrape, or stream any copyrighted material.
                </p>
              </div>
              <div className="h-px w-full bg-white/10 my-2"></div>
              <a href="mailto:siddharthashahthakuri447@gmail.com" className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition">
                <Mail className="w-4 h-4" />
                Contact Lead Developer
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
            Crafted with <Heart className="w-4 h-4 text-red-500 animate-pulse" /> by <span className="text-white font-bold tracking-wide">Dejavuh</span>
          </p>
          <p className="text-xs text-slate-600 font-medium">
            &copy; {new Date().getFullYear()} Da Vinci Tracker. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
