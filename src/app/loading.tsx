"use client";
import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b]/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center">
        {/* Loading GIF */}
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.4)] bg-transparent flex items-center justify-center relative">
           <img 
             src="/loading.gif" 
             alt="Loading..." 
             className="w-full h-full object-cover mix-blend-lighten" 
             onError={(e) => {
               // Fallback if loading.gif is not found
               e.currentTarget.style.display = 'none';
             }}
           />
           {/* CSS Fallback Spinner if image fails */}
           <div className="absolute inset-0 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin -z-10" />
        </div>
        <div className="mt-8 font-bold text-indigo-400 tracking-[0.2em] uppercase animate-pulse drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
          Loading...
        </div>
      </div>
    </div>
  );
}
