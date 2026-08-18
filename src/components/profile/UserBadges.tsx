"use client";

import { Crown, Shield, Star, Zap, Sparkles, Heart } from "lucide-react";
import { isLeadDev, isAdmin } from "@/lib/admin";
import { calculateLevel, MAX_LEVEL } from "@/lib/levels";
import { getHeartRank, heartRankTint } from "@/lib/heartRanks";

export type BadgeUser = {
  id?: string;
  username?: string;
  role?: string | null;
  xp?: number | null;
  activeRole?: string | null;
  activeTag?: string | null;
  /** Worn titles, wearer-ordered — index 0 is the one they lead with. */
  equippedTitles?: string[] | null;
  /** Legacy single title, for accounts that earned one before the rack existed. */
  cardTitle?: string | null;
};

export type BadgeSize = "sm" | "md";

const SIZING: Record<BadgeSize, { pad: string; text: string; icon: string; gap: string }> = {
  sm: { pad: "px-2 py-0.5", text: "text-[9px] sm:text-[10px]", icon: "h-2.5 w-2.5 shrink-0", gap: "gap-1" },
  md: { pad: "px-3.5 py-1", text: "text-[11px] sm:text-xs", icon: "h-3.5 w-3.5 shrink-0", gap: "gap-1.5" },
};

/** The worn titles for a user, honouring the profile rack's own fallback. */
export function wornTitles(user?: BadgeUser | null): string[] {
  if (!user) return [];
  if (Array.isArray(user.equippedTitles)) {
    return user.equippedTitles.filter(Boolean);
  }
  if (user.cardTitle) return [user.cardTitle];
  return [];
}

/**
 * JUST the worn titles, for surfaces that already draw their own role and rank
 * badges and only need the missing piece.
 */
export function TitleChips({
  user,
  size = "sm",
  max = 1,
}: {
  user?: BadgeUser | null;
  size?: BadgeSize;
  max?: number;
}) {
  const titles = wornTitles(user).slice(0, Math.max(0, max));
  if (titles.length === 0) return null;
  const S = SIZING[size];

  return (
    <>
      {titles.map((t, i) => {
        const isBugDetective = t.toLowerCase() === "bug detective";
        if (isBugDetective) {
          return (
            <span
              key={t}
              className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full ${
                size === "md" ? "px-3.5 sm:px-4 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px]" : "px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[22px] sm:min-h-[26px]"
              } font-black tracking-wider whitespace-nowrap border border-pink-400/40 bg-pink-950/20 backdrop-blur-md text-pink-100 shadow-[0_0_16px_rgba(244,63,94,0.25)] transition-all duration-200 hover:scale-105 hover:bg-pink-950/30 hover:border-pink-300/70`}
              title="Bug Detective"
            >
              <img
                src="/icons/bug-detective.png"
                alt="Bug Detective Icon"
                className={size === "md" ? "h-6 w-6 sm:h-7 sm:w-7 object-contain -my-1.5 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "h-4 w-4 sm:h-5 sm:w-5 object-contain -my-1 shrink-0"}
              />
              <img
                src="/titles/bug-detective-wordmark.png"
                alt="Bug Detective"
                className={size === "md" ? "h-4 sm:h-5.5 max-w-[120px] sm:max-w-none object-contain drop-shadow-[0_0_10px_rgba(255,105,180,0.6)]" : "h-3 sm:h-4 max-w-[90px] sm:max-w-none object-contain drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]"}
              />
            </span>
          );
        }
        const isLucifer = t.toLowerCase().includes("lucifer") || t.toLowerCase().includes("fallen angel");
        if (isLucifer) {
          return (
            <span
              key={t}
              className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full ${
                size === "md" ? "px-3.5 sm:px-4 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px] text-xs" : "px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[22px] sm:min-h-[26px] text-[9px] sm:text-[10px]"
              } font-black tracking-wider whitespace-nowrap border border-purple-400/60 bg-gradient-to-r from-[#200536]/60 via-[#380b5c]/50 to-[#1b042e]/60 backdrop-blur-md text-purple-100 shadow-[0_0_22px_rgba(168,85,247,0.5),0_0_40px_rgba(192,132,252,0.25)] transition-all duration-200 hover:scale-105 hover:border-purple-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.7)]`}
              title="Lucifer,the fallen angel"
            >
              <img
                src="/icons/lucifer-gojo.png"
                alt="Lucifer, the fallen angel"
                className={size === "md" ? "h-6 w-6 sm:h-7 sm:w-7 object-contain -my-1.5 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "h-4 w-4 sm:h-5 sm:w-5 object-contain -my-1 shrink-0"}
              />
              <span className="truncate max-w-[120px] sm:max-w-none text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_12px_rgba(192,132,252,0.85)] font-black tracking-wider uppercase">
                Lucifer,the fallen angel
              </span>
            </span>
          );
        }
        return (
          <span
            key={t}
            className={`inline-flex max-w-full items-center ${S.gap} rounded-full ${S.pad} ${S.text} font-black uppercase tracking-wider whitespace-nowrap ${
              i === 0
                ? "border border-amber-400/45 bg-amber-500/15 text-amber-200"
                : "border border-violet-400/35 bg-violet-500/15 text-violet-200"
            }`}
            title="Earned title"
          >
            <Crown className={S.icon} />
            <span className="truncate max-w-[110px] sm:max-w-none">{t}</span>
          </span>
        );
      })}
    </>
  );
}

/**
 * ICON-ONLY BADGES, for dense author lines.
 */
function IconBadge({ icon: Icon, tint, label }: { icon: any; tint: string; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
      style={{ background: `${tint}22`, boxShadow: `inset 0 0 0 1px ${tint}77`, color: tint }}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

/** The same badges as UserBadges, collapsed to icon squares. */
export function UserBadgesCompact({
  user,
  blessed = false,
  maxTitles = 1,
}: {
  user?: BadgeUser | null;
  blessed?: boolean;
  maxTitles?: number;
}) {
  if (!user) return null;
  const lead = isLeadDev(user);
  const admin = !lead && isAdmin(user);
  const level = lead || admin ? MAX_LEVEL : calculateLevel(user.xp || 0);
  const heart = getHeartRank(level);
  const titles = wornTitles(user).slice(0, Math.max(0, maxTitles));

  return (
    <>
      {lead && !(user as any)?.hideLeadRole && (
        <span
          title="Lucifer,the fallen angel"
          aria-label="Lucifer,the fallen angel"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-purple-400/50 bg-purple-950/40 backdrop-blur-md p-0.5 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
        >
          <img src="/icons/lucifer-gojo.png" alt="Lucifer,the fallen angel" className="h-full w-full object-contain" />
        </span>
      )}
      {admin && !lead && <IconBadge icon={Shield} tint="#fbbf24" label="Staff" />}
      {user.activeRole === "role_watcher" && <IconBadge icon={Shield} tint="#c084fc" label="The Watcher" />}
      {user.activeRole === "role_elite" && <IconBadge icon={Star} tint="#facc15" label="Elite" />}
      {user.activeTag === "tag_og" && <IconBadge icon={Zap} tint="#f87171" label="OG" />}
      {user.activeTag === "tag_weeb" && <IconBadge icon={Sparkles} tint="#f472b6" label="Weeb Lord" />}
      {blessed && <IconBadge icon={Sparkles} tint="#fcd34d" label="Blessed" />}
      <IconBadge icon={Heart} tint={heartRankTint(level)} label={`${heart.name} · ${heart.numeral}`} />
      {titles.map((t) => {
        const isBugDetective = t.toLowerCase() === "bug detective";
        if (isBugDetective) {
          return (
            <span
              key={t}
              title="Bug Detective"
              aria-label="Bug Detective"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-pink-400/40 bg-pink-950/20 backdrop-blur-md p-0.5 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
            >
              <img src="/icons/bug-detective.png" alt="Bug Detective" className="h-full w-full object-contain" />
            </span>
          );
        }
        const isLucifer = t.toLowerCase().includes("lucifer") || t.toLowerCase().includes("fallen angel");
        if (isLucifer) {
          return (
            <span
              key={t}
              title="Lucifer,the fallen angel"
              aria-label="Lucifer,the fallen angel"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-purple-400/50 bg-purple-950/40 backdrop-blur-md p-0.5 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
            >
              <img src="/icons/lucifer-gojo.png" alt="Lucifer,the fallen angel" className="h-full w-full object-contain" />
            </span>
          );
        }
        return (
          <IconBadge key={t} icon={Crown} tint="#fbbf24" label={t} />
        );
      })}
    </>
  );
}

export default function UserBadges({
  user,
  blessed = false,
  size = "sm",
  showHeart = true,
  showTitles = true,
  maxTitles = 1,
  className = "",
}: {
  user?: BadgeUser | null;
  blessed?: boolean;
  size?: BadgeSize;
  showHeart?: boolean;
  showTitles?: boolean;
  maxTitles?: number;
  className?: string;
}) {
  if (!user) return null;
  const S = SIZING[size];
  const chip = `inline-flex max-w-full items-center ${S.gap} rounded-full ${S.pad} ${S.text} font-black uppercase tracking-wider whitespace-nowrap`;

  const lead = isLeadDev(user);
  const admin = !lead && isAdmin(user);

  const level = lead || admin ? MAX_LEVEL : calculateLevel(user.xp || 0);
  const heart = getHeartRank(level);
  const titles = showTitles ? wornTitles(user).slice(0, Math.max(0, maxTitles)) : [];

  return (
    <>
      {lead && !(user as any)?.hideLeadRole ? (
        <span
          className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full ${
            size === "md" ? "px-3.5 sm:px-4 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px] text-xs" : "px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[22px] sm:min-h-[26px] text-[9px] sm:text-[10px]"
          } font-black tracking-wider whitespace-nowrap border border-purple-400/60 bg-gradient-to-r from-[#200536]/60 via-[#380b5c]/50 to-[#1b042e]/60 backdrop-blur-md text-purple-100 shadow-[0_0_22px_rgba(168,85,247,0.5),0_0_40px_rgba(192,132,252,0.25)] transition-all duration-200 hover:scale-105 hover:border-purple-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.7)] ${className}`}
          title="Lead Dev · Lucifer,the fallen angel"
        >
          <img
            src="/icons/lucifer-gojo.png"
            alt="Lucifer, the fallen angel"
            className={size === "md" ? "h-6 w-6 sm:h-7 sm:w-7 object-contain -my-1.5 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "h-4 w-4 sm:h-5 sm:w-5 object-contain -my-1 shrink-0"}
          />
          <span className="truncate max-w-[120px] sm:max-w-none text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_12px_rgba(192,132,252,0.85)] font-black tracking-wider uppercase">
            Lucifer,the fallen angel
          </span>
        </span>
      ) : admin ? (
        <span className={`${chip} border border-amber-400/40 bg-amber-500/15 text-amber-300 ${className}`}>
          <Shield className={S.icon} /> <span>Staff</span>
        </span>
      ) : user.activeRole === "role_watcher" ? (
        <span className={`${chip} border border-purple-500/30 bg-purple-500/20 text-purple-300 ${className}`}>
          <Shield className={S.icon} /> <span>Watcher</span>
        </span>
      ) : user.activeRole === "role_elite" ? (
        <span className={`${chip} border border-yellow-500/30 bg-yellow-500/20 text-yellow-300 ${className}`}>
          <Star className={S.icon} /> <span>Elite</span>
        </span>
      ) : null}

      {user.activeTag === "tag_og" && (
        <span className={`${chip} bg-red-500/20 text-red-300`}>
          <Zap className={S.icon} /> <span>OG</span>
        </span>
      )}
      {user.activeTag === "tag_weeb" && (
        <span className={`${chip} bg-pink-500/20 text-pink-300`}>
          <Sparkles className={S.icon} /> <span>Weeb Lord</span>
        </span>
      )}
      {blessed && (
        <span className={`${chip} border border-amber-400/40 bg-amber-400/20 text-amber-300`}>
          <Sparkles className={S.icon} /> <span>Blessed</span>
        </span>
      )}

      {showHeart && (
        <span className={`${chip} ${heart.badgeClass}`} title={`${heart.name} — ${heart.stage}`}>
          <span className="truncate max-w-[100px] sm:max-w-none">{heart.name} · {heart.numeral}</span>
        </span>
      )}

      {titles.map((t, i) => {
        const isBugDetective = t.toLowerCase() === "bug detective";
        if (isBugDetective) {
          return (
            <span
              key={t}
              className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full ${
                size === "md" ? "px-3.5 sm:px-4 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px]" : "px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[22px] sm:min-h-[26px]"
              } font-black tracking-wider whitespace-nowrap border border-pink-400/40 bg-pink-950/20 backdrop-blur-md text-pink-100 shadow-[0_0_16px_rgba(244,63,94,0.25)] transition-all duration-200 hover:scale-105 hover:bg-pink-950/30 hover:border-pink-300/70 ${className}`}
              title="Bug Detective"
            >
              <img
                src="/icons/bug-detective.png"
                alt="Bug Detective Icon"
                className={size === "md" ? "h-6 w-6 sm:h-7 sm:w-7 object-contain -my-1.5 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "h-4 w-4 sm:h-5 sm:w-5 object-contain -my-1 shrink-0"}
              />
              <img
                src="/titles/bug-detective-wordmark.png"
                alt="Bug Detective"
                className={size === "md" ? "h-4 sm:h-5.5 max-w-[120px] sm:max-w-none object-contain drop-shadow-[0_0_10px_rgba(255,105,180,0.6)]" : "h-3 sm:h-4 max-w-[90px] sm:max-w-none object-contain drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]"}
              />
            </span>
          );
        }
        const isLucifer = t.toLowerCase().includes("lucifer") || t.toLowerCase().includes("fallen angel");
        if (isLucifer) {
          return (
            <span
              key={t}
              className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full ${
                size === "md" ? "px-3.5 sm:px-4 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px] text-xs" : "px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-[22px] sm:min-h-[26px] text-[9px] sm:text-[10px]"
              } font-black tracking-wider whitespace-nowrap border border-purple-400/60 bg-gradient-to-r from-[#200536]/60 via-[#380b5c]/50 to-[#1b042e]/60 backdrop-blur-md text-purple-100 shadow-[0_0_22px_rgba(168,85,247,0.5),0_0_40px_rgba(192,132,252,0.25)] transition-all duration-200 hover:scale-105 hover:border-purple-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.7)] ${className}`}
              title="Lucifer,the fallen angel"
            >
              <img
                src="/icons/lucifer-gojo.png"
                alt="Lucifer, the fallen angel"
                className={size === "md" ? "h-6 w-6 sm:h-7 sm:w-7 object-contain -my-1.5 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "h-4 w-4 sm:h-5 sm:w-5 object-contain -my-1 shrink-0"}
              />
              <span className="truncate max-w-[120px] sm:max-w-none text-transparent bg-clip-text bg-gradient-to-r from-[#f3e8ff] via-[#d8b4fe] to-[#c084fc] drop-shadow-[0_0_12px_rgba(192,132,252,0.85)] font-black tracking-wider uppercase">
                Lucifer,the fallen angel
              </span>
            </span>
          );
        }
        return (
          <span
            key={t}
            className={`${chip} ${i === 0
              ? "border border-amber-400/45 bg-amber-500/15 text-amber-200"
              : "border border-violet-400/35 bg-violet-500/15 text-violet-200"}`}
            title="Earned title"
          >
            <Crown className={S.icon} />
            <span className="truncate max-w-[110px] sm:max-w-none">{t}</span>
          </span>
        );
      })}
    </>
  );
}
