import ManhwaGrid from "@/components/anime/ManhwaGrid";
import { BookOpen } from "lucide-react";

export default function ManhwaPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <div className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#141414] to-[#09090b] z-0" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=2000')] bg-cover bg-center opacity-[0.03] z-0" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
            <BookOpen className="w-10 h-10 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-500 mb-6 tracking-tight">
            Manhwa Reader
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-medium">
            Powered by the <span className="text-purple-300 font-bold">manga-sp</span> Python Microservice. Discover and read the latest popular manhwa directly from your dashboard.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <ManhwaGrid />
      </div>
    </div>
  );
}
