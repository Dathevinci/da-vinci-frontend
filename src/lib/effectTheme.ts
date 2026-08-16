// Shared theming derived from a user's equipped Profile Effect, so the profile
// page and the Discord-style profile popout render the same themed name gradient
// and card border/glow without duplicating the long class strings.

/** Themed name gradient (text-clip) for the equipped effect, or "" for none. */
export function effectNameClass(effect?: string | null): string {
  switch (effect) {
    case "effect_crimson":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fecaca,#ef4444,#8b0000,#ef4444,#fecaca)] drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]";
    case "effect_ascension":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ddd6fe,#a855f7,#e879f9,#a855f7,#ddd6fe)] drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]";
    case "effect_tempest":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#bae6fd,#38bdf8,#818cf8,#38bdf8,#bae6fd)] drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]";
    case "effect_fool":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fde68a,#f59e0b,#fde68a,#e2e8f0)] drop-shadow-[0_0_10px_rgba(245,158,11,0.55)]";
    case "effect_evernight":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#fda4af,#e11d48,#fda4af,#e2e8f0)] drop-shadow-[0_0_10px_rgba(225,29,72,0.55)]";
    case "effect_mahoraga":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fff7d6,#FFD700,#B8860B,#FFD700,#fff7d6)] drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]";
    case "effect_ritual":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,#cbd5e1,#64748b,#e8e4d8,#ffffff)] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]";
    case "effect_canopy":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#d9f99d,#34d399,#166534,#a3e635,#d9f99d)] drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]";
    case "effect_samurai":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2e8f0,#f87171,#dc2626,#f87171,#e2e8f0)] drop-shadow-[0_0_10px_rgba(220,38,38,0.6)]";
    case "effect_himalaya":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f1f5f9,#bae6fd,#38bdf8,#bae6fd,#f1f5f9)] drop-shadow-[0_0_10px_rgba(191,219,254,0.6)]";
    case "effect_lotus":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fbcfe8,#34d399,#fde68a,#34d399,#fbcfe8)] drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]";
    case "effect_mango":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ff8c00,#ffd700,#ff1493,#32cd32,#ff8c00)] drop-shadow-[0_0_10px_rgba(255,140,0,0.6)]";
    case "effect_jungle":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#3fae5a,#7a9b3a,#ffe196,#3fae5a,#1f6b38)] drop-shadow-[0_0_10px_rgba(63,174,90,0.6)]";
    case "effect_unblinking":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f2ead8,#9ca3af,#8b0000,#9ca3af,#f2ead8)] drop-shadow-[0_0_10px_rgba(139,0,0,0.6)]";
    case "effect_void":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e0f2fe,#67e8f9,#6366f1,#67e8f9,#e0f2fe)] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
    case "effect_dejavu":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f9fafb,#9ca3af,#8b0000,#00ffff,#f9fafb)] drop-shadow-[0_0_10px_rgba(139,0,0,0.55)]";
    case "effect_hollow":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#93c5fd,#a855f7,#c724f0,#f87171,#93c5fd)] drop-shadow-[0_0_10px_rgba(167,36,240,0.65)]";
    case "effect_outergod":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#99f6e4,#14b8a6,#d81fb4,#14b8a6,#99f6e4)] drop-shadow-[0_0_10px_rgba(13,148,136,0.6)]";
    case "effect_gateway":
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#e2beff,#8a2be2,#ffffff,#ffd700,#e2beff)] drop-shadow-[0_0_10px_rgba(138,43,226,0.65)]";
    case "effect_webslinger":
      // SSS: the name is ALIVE — the silk-light gradient slides through the
      // letters (web-shimmer keyframes live in globals.css). Every surface
      // that calls effectNameClass gets the moving name for free.
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#f8fafc,#22d3ee,#ef4444,#22d3ee,#f8fafc)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]";
    case "effect_portal":
      // SSS living name — acid light sliding through the letters. Same
      // web-shimmer keyframes (it's a generic background-position slide);
      // gradient ends match so the 200% wrap is seamless.
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#d9f99d,#39ff14,#22d3ee,#e879f9,#d9f99d)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(57,255,20,0.55)]";
    case "effect_bankai":
      // SSS living name — scattered sakura light sliding through steel.
      // Ends match (#ffffff…#ffffff) so the 200% wrap is seamless.
      return "text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,#ff9dcc,#ff1493,#cdd6e4,#ffffff)] bg-[length:200%_100%] animate-[web-shimmer_3.5s_linear_infinite] drop-shadow-[0_0_10px_rgba(255,20,147,0.55)]";
    default:
      return "";
  }
}

/** Themed card border + glow for the equipped effect, or "" for none. */
export function effectCardBorderClass(effect?: string | null): string {
  switch (effect) {
    case "effect_crimson": return "!border-red-600/50 shadow-[0_0_45px_rgba(255,0,0,0.35)]";
    case "effect_ascension": return "!border-purple-500/50 shadow-[0_0_45px_rgba(168,85,247,0.4)]";
    case "effect_tempest": return "!border-sky-500/50 shadow-[0_0_45px_rgba(56,189,248,0.35)]";
    case "effect_fool": return "!border-amber-500/40 shadow-[0_0_45px_rgba(245,158,11,0.3)]";
    case "effect_evernight": return "!border-rose-500/40 shadow-[0_0_45px_rgba(225,29,72,0.3)]";
    case "effect_mahoraga": return "!border-yellow-500/50 shadow-[0_0_45px_rgba(255,215,0,0.35)]";
    case "effect_ritual": return "!border-slate-200/50 shadow-[0_0_50px_rgba(255,255,255,0.35)]";
    case "effect_canopy": return "!border-emerald-500/50 shadow-[0_0_45px_rgba(16,185,129,0.35)]";
    case "effect_samurai": return "!border-red-500/40 shadow-[0_0_45px_rgba(185,28,28,0.4)]";
    case "effect_himalaya": return "!border-sky-300/40 shadow-[0_0_45px_rgba(191,219,254,0.4)]";
    case "effect_lotus": return "!border-emerald-400/40 shadow-[0_0_45px_rgba(52,211,153,0.4)]";
    case "effect_mango": return "!border-orange-400/50 shadow-[0_0_45px_rgba(255,140,0,0.45)]";
    case "effect_jungle": return "!border-green-500/45 shadow-[0_0_45px_rgba(31,107,56,0.5)]";
    case "effect_unblinking": return "!border-red-900/50 shadow-[0_0_45px_rgba(139,0,0,0.45)]";
    case "effect_void": return "!border-cyan-400/50 shadow-[0_0_50px_rgba(34,211,238,0.35)]";
    case "effect_dejavu": return "!border-red-900/60 shadow-[0_0_50px_rgba(139,0,0,0.4),0_0_24px_rgba(0,255,255,0.15)]";
    case "effect_hollow": return "!border-purple-500/60 shadow-[0_0_50px_rgba(167,36,240,0.4),0_0_24px_rgba(27,79,224,0.2)]";
    case "effect_outergod": return "!border-teal-500/50 shadow-[0_0_50px_rgba(13,148,136,0.4),0_0_24px_rgba(216,31,180,0.25)]";
    case "effect_gateway": return "!border-violet-500/50 shadow-[0_0_50px_rgba(138,43,226,0.4),0_0_24px_rgba(255,215,0,0.25)]";
    case "effect_webslinger": return "!border-cyan-400/50 shadow-[0_0_45px_rgba(34,211,238,0.35),0_0_24px_rgba(220,38,38,0.2)]";
    case "effect_portal": return "!border-lime-400/50 shadow-[0_0_50px_rgba(57,255,20,0.3),0_0_24px_rgba(232,121,249,0.22)]";
    case "effect_bankai": return "!border-pink-400/50 shadow-[0_0_50px_rgba(255,20,147,0.3),0_0_24px_rgba(205,214,228,0.22)]";
    default: return "!border-white/10";
  }
}
