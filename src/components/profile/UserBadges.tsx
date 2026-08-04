"use client";

import { Crown, Shield, Star, Zap, Sparkles } from "lucide-react";
import { isLeadDev, isAdmin } from "@/lib/admin";
import { calculateLevel } from "@/lib/levels";
import { getHeartRank } from "@/lib/heartRanks";

/**
 * WHO SOMEBODY IS, in one strip, in one place.
 *
 * This markup used to be copy-pasted into four files — the profile hero, the
 * profile popout, the forum's AuthorLine and CommunityFeed — at four different
 * sizes with four slightly different rules. They had already drifted: the two
 * community copies decided Lead Dev from the USERNAME STRING alone, so a Lead
 * Dev who renamed, or an admin promoted by role rather than by being on the
 * hardcoded list, simply lost their badge on every comment they wrote. Roles
 * live in a database column precisely so they survive a rename; reading the
 * name instead threw that away.
 *
 * Three separate systems land here, which is worth naming because they are
 * easy to mistake for one another:
 *
 *   ROLE   — Lead Dev / Staff / Watcher / Elite. From the account's `role`
 *            column, or a shop-bought `activeRole`. Not chosen from a wardrobe.
 *   RANK   — the Heart Cultivation rank ("The All-Bearing · X"). Derived from
 *            XP. Cannot be worn or removed; you are whatever your XP says.
 *   TITLES — the only genuinely WEARABLE thing: earned by completing a card
 *            set, chosen and ordered in the profile's title rack, capped at 3.
 *
 * Only the third is manageable, which is why the title manager cannot offer to
 * hide the first two.
 */

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

/**
 * `sm` is for comment and forum author lines, where the badges share a row with
 * a name and a timestamp and must not wrap it. `md` is for profile surfaces
 * that have a row to themselves.
 */
export type BadgeSize = "sm" | "md";

const SIZING: Record<BadgeSize, { pad: string; text: string; icon: string; gap: string }> = {
  sm: { pad: "px-1.5 py-0.5", text: "text-[9px]", icon: "h-2.5 w-2.5", gap: "gap-1" },
  md: { pad: "px-2.5 py-1", text: "text-[11px]", icon: "h-3 w-3", gap: "gap-1.5" },
};

/** The worn titles for a user, honouring the profile rack's own fallback. */
export function wornTitles(user?: BadgeUser | null): string[] {
  if (!user) return [];
  const worn = Array.isArray(user.equippedTitles) ? user.equippedTitles.filter(Boolean) : [];
  // The rack falls back to the legacy single title when nothing is equipped.
  // Matching that here is what stops a user showing a title on their profile
  // and no title on every comment they write.
  if (worn.length === 0 && user.cardTitle) return [user.cardTitle];
  return worn;
}

/**
 * JUST the worn titles, for surfaces that already draw their own role and rank
 * badges and only need the missing piece.
 *
 * CommunityFeed is the reason this exists: its cascade is richer than the
 * forum's — it renders the XP rank theme with its own icon — so replacing it
 * wholesale would trade a real feature for consistency. It gets the titles
 * appended instead.
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
      {titles.map((t, i) => (
        <span
          key={t}
          className={`inline-flex items-center ${S.gap} rounded-full ${S.pad} ${S.text} font-black uppercase tracking-wider whitespace-nowrap ${
            i === 0
              ? "border border-amber-400/45 bg-amber-500/15 text-amber-200"
              : "border border-violet-400/35 bg-violet-500/15 text-violet-200"
          }`}
          title="Earned title"
        >
          <Crown className={S.icon} /> {t}
        </span>
      ))}
    </>
  );
}

export default function UserBadges({
  user,
  blessed = false,
  size = "sm",
  showHeart = true,
  showTitles = true,
  /**
   * How many titles to draw. An author line has far less room than a profile
   * panel, so comment surfaces show only the title the wearer leads with —
   * their index 0, the same one the rack renders in gold.
   */
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
  const chip = `inline-flex items-center ${S.gap} rounded-full ${S.pad} ${S.text} font-black uppercase tracking-wider whitespace-nowrap`;

  // OBJECT form, not the username string. These helpers read the role column
  // first and only fall back to the hardcoded name list — passing a bare name
  // (which the forum did) discards the authoritative half of the check.
  const lead = isLeadDev(user);
  const admin = !lead && isAdmin(user);

  // Staff sit at the top of the rank ladder regardless of XP, matching how the
  // profile hero and the popout already compute it.
  const level = lead || admin ? 10 : calculateLevel(user.xp || 0);
  const heart = getHeartRank(level);
  const titles = showTitles ? wornTitles(user).slice(0, Math.max(0, maxTitles)) : [];

  return (
    <>
      {lead ? (
        <span className={`${chip} bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-[0_0_14px_rgba(168,85,247,.55)] ${className}`}>
          <Crown className={S.icon} /> Lead Dev
        </span>
      ) : admin ? (
        <span className={`${chip} border border-amber-400/40 bg-amber-500/15 text-amber-300 ${className}`}>
          <Shield className={S.icon} /> Staff
        </span>
      ) : user.activeRole === "role_watcher" ? (
        <span className={`${chip} border border-purple-500/30 bg-purple-500/20 text-purple-300 ${className}`}>
          <Shield className={S.icon} /> Watcher
        </span>
      ) : user.activeRole === "role_elite" ? (
        <span className={`${chip} border border-yellow-500/30 bg-yellow-500/20 text-yellow-300 ${className}`}>
          <Star className={S.icon} /> Elite
        </span>
      ) : null}

      {user.activeTag === "tag_og" && (
        <span className={`${chip} bg-red-500/20 text-red-300`}>
          <Zap className={S.icon} /> OG
        </span>
      )}
      {user.activeTag === "tag_weeb" && (
        <span className={`${chip} bg-pink-500/20 text-pink-300`}>
          <Sparkles className={S.icon} /> Weeb Lord
        </span>
      )}
      {blessed && (
        <span className={`${chip} border border-amber-400/40 bg-amber-400/20 text-amber-300`}>
          <Sparkles className={S.icon} /> Blessed
        </span>
      )}

      {/* The Heart rank carries its own gradient per tier, so it is styled from
          the rank rather than from this file — a rank that looked the same at
          every tier would defeat the point of having ten of them. */}
      {showHeart && (
        <span className={`${chip} ${heart.badgeClass}`} title={`${heart.name} — ${heart.stage}`}>
          {heart.name} · {heart.numeral}
        </span>
      )}

      {/* Worn titles LAST, so the strip reads role → rank → what they chose.
          Gold for the one they lead with, matching the profile rack exactly. */}
      {titles.map((t, i) => (
        <span
          key={t}
          className={`${chip} ${i === 0
            ? "border border-amber-400/45 bg-amber-500/15 text-amber-200"
            : "border border-violet-400/35 bg-violet-500/15 text-violet-200"}`}
          title="Earned title"
        >
          <Crown className={S.icon} /> {t}
        </span>
      ))}
    </>
  );
}
