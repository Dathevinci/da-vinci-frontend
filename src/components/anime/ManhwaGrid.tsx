"use client";

import { useState, useEffect } from "react";
import { ServerCrash, Loader2, BookOpen } from "lucide-react";

interface ManhwaItem {
  title: string;
  manga_url: string;
  cover: string;
}

export default function ManhwaGrid() {
  const [manhwa, setManhwa] = useState<ManhwaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManhwa = async () => {
      try {
        const res = await fetch("http://localhost:5000/manga/popular");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // The python API returns { value: [...] } instead of a direct array
        setManhwa(data.value || data);
      } catch (err) {
        setError("Could not connect to the Python Manga Server.");
      } finally {
        setLoading(false);
      }
    };

    fetchManhwa();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Connecting to manga-sp microservice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto mt-8">
        <ServerCrash className="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-red-200 mb-4">Manga Server Offline</h3>
        <p className="text-slate-300 mb-6">
          The Next.js frontend could not connect to the Python <code>manga-sp</code> backend on port 5000. 
        </p>
        <div className="bg-[#09090b] rounded-lg p-6 text-left border border-white/5 shadow-inner">
          <h4 className="text-white font-bold mb-2">How to start the server:</h4>
          <ol className="list-decimal list-inside text-slate-400 space-y-2 text-sm font-mono">
            <li>cd ../manga-sp</li>
            <li>pip install -r requirements.txt</li>
            <li>python app.py</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {manhwa.map((m, idx) => (
        <a 
          key={idx} 
          href={m.manga_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-[#141414] border border-white/5 shadow-xl transition-transform duration-300 hover:scale-105 hover:z-50 cursor-pointer block"
        >
          <img 
            src={m.cover.startsWith('http') ? m.cover : `https://www.mangabats.com${m.cover}`} 
            alt={m.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <h3 className="font-bold text-white text-sm md:text-base line-clamp-2 mb-3">{m.title}</h3>
            <div className="w-full py-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors">
              <BookOpen className="w-4 h-4" />
              Read
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
