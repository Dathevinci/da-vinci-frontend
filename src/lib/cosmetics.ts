// Username color / gradient cosmetics (shop "color" items). Centralized so the
// profile, community feed, and anywhere else render usernames consistently.
const NAME_COLORS: Record<string, string> = {
  color_gold: "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]",
  color_neon_pink: "text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]",
  // Gradient names (bg-clip-text over an arbitrary multi-stop gradient).
  color_rainbow: "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fb7185,#fcd34d,#34d399,#60a5fa,#c084fc)]",
  color_fire: "text-transparent bg-clip-text bg-[linear-gradient(to_right,#fcd34d,#f97316,#e11d48)] drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]",
  color_ocean: "text-transparent bg-clip-text bg-[linear-gradient(to_right,#67e8f9,#38bdf8,#6366f1)] drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]",
  color_aurora: "text-transparent bg-clip-text bg-[linear-gradient(to_right,#6ee7b7,#2dd4bf,#e879f9)] drop-shadow-[0_0_8px_rgba(94,234,212,0.4)]",
};

// CSS classes for a username's color/gradient cosmetic, or null if none/unknown.
export function nameColorClass(activeColor?: string | null): string | null {
  return activeColor ? NAME_COLORS[activeColor] || null : null;
}
