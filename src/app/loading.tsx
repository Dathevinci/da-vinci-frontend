import React from "react";

export default function Loading() {
  // Generate a static array of bubbles for SSR safety
  const bubbles = Array.from({ length: 25 }).map((_, i) => {
    const isPurple = i % 2 === 0;
    return {
      id: i,
      left: `${(i * 13 + 17) % 100}%`,
      animationDelay: `${((i * 7 + 11) % 20) * 0.2}s`,
      animationDuration: `${4 + ((i * 5) % 10) * 0.4}s`,
      size: 10 + ((i * 11) % 15),
      color: isPurple ? "rgba(168,85,247,0.8)" : "rgba(217,70,239,0.8)",
      shadow: isPurple ? "rgba(168,85,247,0.5)" : "rgba(217,70,239,0.5)"
    };
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505]/70 flex flex-col items-center justify-center overflow-hidden animate-[blurIn_1s_ease-out_forwards]">
      <style>{`
        @keyframes blurIn {
          0% { backdrop-filter: blur(0px); opacity: 0; }
          100% { backdrop-filter: blur(12px); opacity: 1; }
        }
        @keyframes floatUp {
          0% { transform: translateY(110vh) translateX(0) scale(0.8); opacity: 0; }
          20% { opacity: 0.8; transform: translateY(80vh) translateX(-15px) scale(1); }
          80% { opacity: 0.8; transform: translateY(20vh) translateX(15px) scale(1); }
          100% { transform: translateY(-10vh) translateX(-5px) scale(0.8); opacity: 0; }
        }
      `}</style>

      {/* God Mode Bubbles Background */}
      <div className="absolute inset-0 z-0 pointer-events-none mix-blend-screen">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 to-fuchsia-600/10" />
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute top-0 rounded-full"
            style={{
              left: bubble.left,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              background: `radial-gradient(circle, ${bubble.color} 0%, transparent 70%)`,
              animation: `floatUp ${bubble.animationDuration} ease-in-out infinite`,
              animationDelay: bubble.animationDelay,
              boxShadow: `0 0 20px ${bubble.shadow}`,
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
