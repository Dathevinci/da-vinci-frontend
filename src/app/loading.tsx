import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b]/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center">
        {/* Luffy Running GIF */}
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.4)] bg-[#09090b] flex items-center justify-center p-2">
           <img 
             src="https://media.giphy.com/media/tuCFp8ru10zks/giphy.gif" 
             alt="Loading..." 
             className="w-full h-full object-cover rounded-full mix-blend-screen" 
           />
        </div>
        <div className="mt-8 font-bold text-indigo-400 tracking-[0.2em] uppercase animate-pulse">
          Loading...
        </div>
      </div>
    </div>
  );
}
