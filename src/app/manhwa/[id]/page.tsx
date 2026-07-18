"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ChevronLeft, BookOpen, User, Tag, Clock, Star, ShieldAlert, AlignLeft } from "lucide-react";
import { IMangaInfo } from "@/lib/asura/models";
import ManhwaTrackerButton from "@/components/manhwa/ManhwaTrackerButton";
import CommunityFeed from "@/components/community/CommunityFeed";

export default function ManhwaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);

  const [manhwa, setManhwa] = useState<IMangaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/manhwa/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data: any) => {
        if (data.error) {
          console.error(data.error);
          setManhwa(null);
        } else {
          setManhwa(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="bg-[#0b0b0c] min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#a3a3a3]">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="font-bold tracking-widest uppercase text-xs">Loading Series</div>
        </div>
      </div>
    );
  }

  if (!manhwa) {
    return (
      <div className="bg-[#0b0b0c] min-h-screen pt-24 pb-16 flex flex-col items-center justify-center text-white">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Series Not Found</h2>
        <p className="text-[#a3a3a3] mb-8">Could not load details from AsuraScans or the series was removed.</p>
        <Link href="/manhwa" className="px-6 py-3 bg-[#1e1e24] hover:bg-[#2a2a32] rounded-lg font-bold text-sm transition">
          Return to Browse
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0b0c] min-h-screen pt-20 pb-16 text-[#e2e8f0] font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#737373] mb-6">
          <Link href="/" className="hover:text-indigo-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/manhwa" className="hover:text-indigo-400 transition-colors">Comics</Link>
          <span>/</span>
          <span className="text-[#e2e8f0] truncate max-w-[200px]">{manhwa.title}</span>
        </div>

        {/* Main Content Card (Asura Layout) */}
        <div className="bg-[#151518] border border-[#2a2a32] rounded-xl overflow-hidden shadow-2xl relative mb-12">
          {/* subtle top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
          
          <div className="flex flex-col md:flex-row p-6 md:p-8 gap-8">
            
            {/* Left Column: Cover & Actions */}
            <div className="flex-shrink-0 mx-auto md:mx-0 w-[240px] flex flex-col gap-4">
              <div className="w-full aspect-[2/3] rounded-lg overflow-hidden border border-[#2a2a32] shadow-lg bg-[#0b0b0c]">
                {manhwa.image ? (
                  <img src={`/api/manhwa-image?url=${encodeURIComponent(manhwa.image)}`} alt={manhwa.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-[#2a2a32]" />
                  </div>
                )}
              </div>
              
              {/* Tracker / Bookmark */}
              <ManhwaTrackerButton manhwa={manhwa} className="w-full" />
              
              {/* Read First/Last Chapter Buttons */}
              {manhwa.chapters && manhwa.chapters.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Link 
                    href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(manhwa.chapters[manhwa.chapters.length - 1].id)}`}
                    className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs text-center flex flex-col items-center justify-center transition-colors shadow-md shadow-indigo-900/20"
                  >
                    <span>First</span>
                    <span className="opacity-70 font-medium">Chapter</span>
                  </Link>
                  <Link 
                    href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(manhwa.chapters[0].id)}`}
                    className="py-3 bg-[#1e1e24] hover:bg-[#2a2a32] text-white rounded-lg font-bold text-xs text-center flex flex-col items-center justify-center transition-colors border border-[#2a2a32]"
                  >
                    <span>Latest</span>
                    <span className="opacity-70 font-medium">Chapter</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Right Column: Title & Info */}
            <div className="flex-1 flex flex-col min-w-0">
              
              <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-black uppercase tracking-widest">
                <span className={`px-2 py-1 rounded ${
                  manhwa.status?.toLowerCase() === 'ongoing' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  manhwa.status?.toLowerCase() === 'completed' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  'bg-[#1e1e24] text-[#a3a3a3] border border-[#2a2a32]'
                }`}>
                  {manhwa.status || "Unknown"}
                </span>
                {manhwa.rating && (
                  <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded">
                    <Star className="w-3 h-3 fill-yellow-400" /> {Number(manhwa.rating).toFixed(1)}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-black mb-6 leading-tight text-white drop-shadow-md">
                {manhwa.title}
              </h1>

              {/* Asura-style Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 bg-[#0b0b0c] p-4 rounded-lg border border-[#2a2a32]">
                {manhwa.authors && manhwa.authors.length > 0 && (
                  <div>
                    <div className="text-[#737373] text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Author
                    </div>
                    <div className="text-sm font-medium text-[#e2e8f0] truncate" title={manhwa.authors.join(", ")}>
                      {manhwa.authors.join(", ")}
                    </div>
                  </div>
                )}
                {manhwa.artist && (
                  <div>
                    <div className="text-[#737373] text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Artist
                    </div>
                    <div className="text-sm font-medium text-[#e2e8f0] truncate" title={manhwa.artist}>
                      {manhwa.artist}
                    </div>
                  </div>
                )}
                {manhwa.updatedOn && (
                  <div>
                    <div className="text-[#737373] text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Updated On
                    </div>
                    <div className="text-sm font-medium text-[#e2e8f0] truncate">
                      {new Date(manhwa.updatedOn).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>

              {/* Synopsis */}
              <div className="mb-8 flex-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-3 flex items-center gap-2 border-b border-[#2a2a32] pb-2">
                  <AlignLeft className="w-4 h-4 text-indigo-400" /> Synopsis
                </h3>
                <div 
                  className="text-[#a3a3a3] text-sm leading-relaxed max-w-none whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: manhwa.description || "No synopsis available for this series." }}
                />
              </div>

              {/* Genres */}
              {manhwa.genres && manhwa.genres.length > 0 && (
                <div className="mt-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {manhwa.genres.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-[#1e1e24] hover:bg-[#2a2a32] border border-[#2a2a32] rounded text-xs font-bold text-[#e2e8f0] transition-colors cursor-pointer">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chapter List (Asura Striped Format) */}
        <div className="bg-[#151518] border border-[#2a2a32] rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-[#2a2a32] bg-[#0b0b0c] flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> Chapters
            </h3>
            <span className="text-xs font-bold text-[#737373] bg-[#1e1e24] px-2 py-1 rounded">
              {manhwa.chapters?.length || 0} Total
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {manhwa.chapters && manhwa.chapters.length > 0 ? (
              <div className="flex flex-col">
                {manhwa.chapters.map((chap, index) => (
                  <Link 
                    key={chap.id}
                    href={`/manhwa/${encodeURIComponent(id)}/chapter/${encodeURIComponent(chap.id)}`}
                    className={`flex items-center justify-between px-6 py-3.5 hover:bg-[#2a2a32] transition-colors group ${index % 2 === 0 ? 'bg-[#151518]' : 'bg-[#1a1a1f]'} text-[#e2e8f0] visited:text-[#8a2be2]`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-indigo-500 font-black opacity-30 text-xs w-6 text-right group-hover:text-indigo-400 group-hover:opacity-100 transition-all">
                        {manhwa.chapters!.length - index}
                      </div>
                      <div className="font-bold group-hover:text-indigo-300 transition-colors truncate">
                        {chap.title}
                      </div>
                    </div>
                    {chap.releaseDate && (
                      <div className="text-[10px] font-bold text-[#737373] uppercase tracking-wider shrink-0 ml-4 group-hover:text-[#a3a3a3] transition-colors">
                        {chap.releaseDate}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-[#737373] font-medium text-sm">
                No chapters available yet. Check back later!
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 lg:px-8 mt-8 pb-12">
        <CommunityFeed mangaId={manhwa.id} mangaTitle={manhwa.title} />
      </div>
    </div>
  );
}
