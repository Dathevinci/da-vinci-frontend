import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505]/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center justify-center">
        {/* Outer pulsating glow */}
        <div className="absolute w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl animate-[pulse_3s_ease-in-out_infinite]" />
        
        {/* Fluid layered spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/10" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 border-r-indigo-400 animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.26,1.55)_infinite]" />
          <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-indigo-300 border-l-indigo-400 animate-[spin_2s_ease-in-out_infinite_reverse]" />
          <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
            <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <div className="mt-8 text-xs font-bold text-indigo-200 tracking-[0.5em] uppercase animate-pulse">
          Loading
        </div>
      </div>
    </div>
  );
}
