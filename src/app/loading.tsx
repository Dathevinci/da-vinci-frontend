import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b]/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        {/* Luffy Running GIF */}
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.3)] bg-[#09090b] flex items-center justify-center relative">
           <img 
             src="https://media.tenor.com/FwF4m9Z33XAAAAAC/luffy-running.gif" 
             alt="Loading..." 
             className="w-[120%] h-[120%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
           />
        </div>
        <div className="mt-6 font-bold text-indigo-400 tracking-widest uppercase animate-pulse">
          Loading Data...
        </div>
      </div>
    </div>
  );
}
