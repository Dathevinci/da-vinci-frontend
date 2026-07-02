import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] overflow-hidden animate-in fade-in duration-500">
      
      {/* Background Image with smooth CSS animation */}
      <div className="absolute inset-0 w-full h-full" style={{ animation: "loadingBg 2s ease-out forwards" }}>
        <img 
          src="/bg.jpg" 
          alt="Loading..." 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-[#050505]/30 pointer-events-none" />
      </div>

      <style>{`
        @keyframes loadingBg {
          0% { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Centered Loader Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
        {/* Smooth CSS Spinner */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/20 rounded-full"></div>
          <div className="absolute w-16 h-16 border-[3px] border-transparent border-t-indigo-500 rounded-full animate-spin shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
        </div>
        <div className="mt-8 text-sm font-bold text-indigo-100 tracking-[0.4em] uppercase opacity-80 animate-pulse drop-shadow-md">
          Loading
        </div>
      </div>
    </div>
  );
}
