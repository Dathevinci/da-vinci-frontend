import React from "react";

export default function Loading() {
  // Generate a static array of droplets for SSR safety
  const droplets = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    left: `${(i * 7 + 13) % 100}%`,
    animationDelay: `${((i * 3 + 7) % 20) * 0.1}s`,
    animationDuration: `${1 + ((i * 5) % 10) * 0.1}s`,
    opacity: 0.2 + ((i * 7) % 5) * 0.1,
    size: 2 + ((i * 11) % 4),
  }));

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505]/70 flex flex-col items-center justify-center overflow-hidden animate-[blurIn_1s_ease-out_forwards]">
      <style>{`
        @keyframes blurIn {
          0% { backdrop-filter: blur(0px); opacity: 0; }
          100% { backdrop-filter: blur(12px); opacity: 1; }
        }
        @keyframes dropFall {
          0% { transform: translateY(-10vh) scaleY(1); opacity: 0; }
          10% { opacity: 1; }
          80% { transform: translateY(100vh) scaleY(1.5); opacity: 1; }
          100% { transform: translateY(110vh) scaleY(1); opacity: 0; }
        }
      `}</style>

      {/* Water Droplets Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {droplets.map((drop) => (
          <div
            key={drop.id}
            className="absolute top-0 bg-indigo-300 rounded-full"
            style={{
              left: drop.left,
              width: `${drop.size}px`,
              height: `${drop.size * 6}px`,
              opacity: drop.opacity,
              animation: `dropFall ${drop.animationDuration} linear infinite`,
              animationDelay: drop.animationDelay,
              boxShadow: '0 0 10px rgba(165, 180, 252, 0.5)',
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Outer pulsating glow */}
        <div className="absolute w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-[pulse_3s_ease-in-out_infinite]" />
        
        {/* Fluid layered spinner / logo container */}
        <div className="relative w-24 h-24 shadow-[0_0_40px_rgba(99,102,241,0.2)] rounded-full bg-[#050505]/50 backdrop-blur-sm">
          <div className="absolute inset-0 rounded-full border-[2px] border-indigo-500/10" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 border-r-indigo-400 animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.26,1.55)_infinite]" />
          <div className="absolute inset-2 rounded-full border-[2px] border-transparent border-b-indigo-300 border-l-indigo-400 animate-[spin_2s_ease-in-out_infinite_reverse]" />
          <div className="absolute inset-0 flex items-center justify-center text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <div className="mt-8 text-xs font-bold text-indigo-200 tracking-[0.6em] uppercase animate-pulse drop-shadow-[0_0_8px_rgba(165,180,252,0.8)]">
          Loading
        </div>
      </div>
    </div>
  );
}
