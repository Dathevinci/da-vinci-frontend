export interface RankTheme {
  title: string | null;
  textGradient: string;
  badgeClass: string;
  badgeIcon: any; // We'll pass the string name and map it to Lucide icons in the component
  borderClass: string;
  glowClass: string;
  bgCardClass: string;
  tabUnderlineClass: string;
  textColorClass: string;
}

export function getRankTheme(points: number = 0, username: string = ""): RankTheme {
  const name = username?.toLowerCase() || "";

  // 1. Ultimate Override: LEAD DEV
  if (name === "dejavuh") {
    return {
      title: "LEAD DEV",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]",
      badgeClass: "bg-gradient-to-r from-indigo-500 to-purple-600 border border-indigo-400 shadow-lg shadow-indigo-500/20 text-white",
      badgeIcon: "Code2",
      borderClass: "border-purple-500",
      glowClass: "shadow-[0_0_30px_rgba(168,85,247,0.6)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-purple-500/30",
      tabUnderlineClass: "bg-purple-500",
      textColorClass: "text-purple-400",
    };
  }

  // 2. Great old one (10000+) - Cosmic Crimson Theme
  if (points >= 10000) {
    return {
      title: "Great old one",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-600 to-red-900 drop-shadow-[0_0_15px_rgba(225,29,72,0.8)]",
      badgeClass: "bg-gradient-to-r from-red-900 to-black border border-red-500 shadow-lg shadow-red-600/50 text-red-400",
      badgeIcon: "Sparkles",
      borderClass: "border-red-600",
      glowClass: "shadow-[0_0_30px_rgba(225,29,72,0.6)]",
      bgCardClass: "bg-black/60 backdrop-blur-xl border-red-600/40",
      tabUnderlineClass: "bg-red-600",
      textColorClass: "text-red-500",
    };
  }

  // 3. King of angel (2000+) - Ruby/Orange Theme
  if (points >= 2000) {
    return {
      title: "King of angel",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]",
      badgeClass: "bg-gradient-to-r from-orange-500 to-red-600 border border-orange-400 shadow-lg shadow-orange-500/30 text-white",
      badgeIcon: "Crown",
      borderClass: "border-orange-500",
      glowClass: "shadow-[0_0_30px_rgba(249,115,22,0.6)]",
      bgCardClass: "bg-black/50 backdrop-blur-xl border-orange-500/30",
      tabUnderlineClass: "bg-orange-500",
      textColorClass: "text-orange-400",
    };
  }

  // 4. Angel (1000+) - Gold/Yellow Theme
  if (points >= 1000) {
    return {
      title: "Angel",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-amber-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]",
      badgeClass: "bg-gradient-to-r from-yellow-500 to-amber-600 border border-yellow-400 shadow-lg shadow-yellow-500/30 text-white",
      badgeIcon: "Feather",
      borderClass: "border-yellow-400",
      glowClass: "shadow-[0_0_30px_rgba(234,179,8,0.6)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-yellow-400/30",
      tabUnderlineClass: "bg-yellow-400",
      textColorClass: "text-yellow-400",
    };
  }

  // 5. Demigod (500+) - Sapphire/Blue Theme
  if (points >= 500) {
    return {
      title: "Demigod",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]",
      badgeClass: "bg-gradient-to-r from-blue-500 to-indigo-600 border border-blue-400 shadow-lg shadow-blue-500/30 text-white",
      badgeIcon: "Zap",
      borderClass: "border-blue-500",
      glowClass: "shadow-[0_0_30px_rgba(59,130,246,0.6)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-blue-500/30",
      tabUnderlineClass: "bg-blue-500",
      textColorClass: "text-blue-400",
    };
  }

  // 6. Medium Demigod (100+) - Emerald/Green Theme
  if (points >= 100) {
    return {
      title: "Medium Demigod",
      textGradient: "text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]",
      badgeClass: "bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-400 shadow-lg shadow-emerald-500/30 text-white",
      badgeIcon: "Leaf",
      borderClass: "border-emerald-500",
      glowClass: "shadow-[0_0_30px_rgba(16,185,129,0.6)]",
      bgCardClass: "bg-black/40 backdrop-blur-xl border-emerald-500/30",
      tabUnderlineClass: "bg-emerald-500",
      textColorClass: "text-emerald-400",
    };
  }

  // 7. Novice (0-99) - Default Theme
  return {
    title: null,
    textGradient: "text-white",
    badgeClass: "hidden",
    badgeIcon: "User",
    borderClass: "border-[#141414]",
    glowClass: "shadow-xl",
    bgCardClass: "bg-black/40 backdrop-blur-xl border-white/10",
    tabUnderlineClass: "bg-indigo-500",
    textColorClass: "text-purple-400",
  };
}
