export default function Footer() {
  return (
    <footer className="mt-20 py-12 bg-[#09090b] text-slate-500 border-t border-white/5">
      <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
             <img src="/logo.jpg" alt="Logo" className="w-6 h-6 rounded-full" />
             Da Vinci
          </h4>
          <p className="text-sm">A modern, legal anime information dashboard powered by the AniList GraphQL API. We track, we don't stream.</p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Navigation</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-indigo-400">Dashboard</a></li>
            <li><a href="/search" className="hover:text-indigo-400">Search</a></li>
            <li><a href="/calendar" className="hover:text-indigo-400">Airing Calendar</a></li>
            <li><a href="/profile" className="hover:text-indigo-400">My Tracker</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Data Source</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400">AniList.co</a></li>
            <li><a href="https://github.com/AniList/ApiV2-GraphQL-Docs" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400">GraphQL API Docs</a></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 text-center text-xs text-slate-600">
        <p>This is an educational tracker project. It does not host, scrape, or stream copyrighted material.</p>
      </div>
    </footer>
  );
}
