"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Activity, Calendar, Users, Layers, Swords, Trophy, Gavel,
  ShoppingBag, Search, Bell, Settings, LogOut, Terminal, BookMarked, BookOpen, Tv,
  ChevronDown, Store,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { isAdmin, isLeadDev } from "@/lib/admin";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";

/**
 * NAV ISLAND — the desktop navigation, as one floating capsule.
 *
 * A full-width bar spent 96px of every screen restating the same twelve links.
 * Reduced to icons the whole thing fits in a pill you can put in the middle of
 * the screen and forget about, which is why it no longer needs to hide: it was
 * only ever hiding because it was too big to leave up.
 *
 * Every destination carries a label that appears on hover. An icon-only bar
 * without them is a memory test, and this site has enough destinations that
 * nobody should be expected to memorise glyphs.
 *
 * DESKTOP ONLY. Mounted by Navbar behind `hidden lg:flex`, and the original bar
 * keeps `lg:hidden` — touch devices have no hover, so labels could never
 * appear, and the existing mobile menu already works.
 */

type Dest = { href: string; label: string; Icon: any };

/** Everything reachable, grouped so the island reads in three beats. */
const READ: Record<string, Dest[]> = {
  anime: [
    { href: "/", label: "Dashboard", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/airing", label: "Airing Now", Icon: Activity },
    { href: "/calendar", label: "Schedule", Icon: Calendar },
  ],
  manhwa: [
    { href: "/manhwa", label: "Dashboard", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
  ],
  novel: [
    { href: "/novel", label: "Library", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
  ],
};

const PLAY: Dest[] = [
  { href: "/cards", label: "Arise Cards", Icon: Layers },
  { href: "/duels", label: "Card Duels", Icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { href: "/auctions", label: "Auction House", Icon: Gavel },
  { href: "/marketplace", label: "Marketplace", Icon: Store },
];

const SOCIAL: Dest[] = [
  { href: "/community", label: "Community", Icon: Users },
  { href: "/shop", label: "Shop", Icon: ShoppingBag },
];

const MODES = [
  { m: "anime" as const, label: "Anime", Icon: Tv },
  { m: "manhwa" as const, label: "Manhwa", Icon: BookMarked },
  { m: "novel" as const, label: "Novels", Icon: BookOpen },
];

/** An icon with a label that rises on hover. Pure transform/opacity. */
function IslandLink({
  href, label, Icon, active, accent, onClick,
}: Dest & { active?: boolean; accent: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const body = (
    <>
      <Icon className="h-[18px] w-[18px]" />
      {/* The tooltip is always mounted and only animates opacity/transform —
          mounting it on hover would cost a layout pass on every pointer move. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0b0b12]/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.6)] backdrop-blur"
        style={{
          transform: `translateX(-50%) translateY(${hover ? "0" : "-4px"}) scale(${hover ? 1 : 0.94})`,
          opacity: hover ? 1 : 0,
          transition: "opacity 140ms ease, transform 180ms cubic-bezier(.34,1.4,.64,1)",
          willChange: "transform, opacity",
        }}
      >
        {label}
      </span>
    </>
  );
  const cls = `relative grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 ${
    active ? "text-white" : "text-slate-400 hover:text-white"
  }`;
  const style = active
    ? { background: `linear-gradient(140deg, ${accent}55, ${accent}22)`, boxShadow: `inset 0 0 0 1px ${accent}88` }
    : undefined;

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      className={cls}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {body}
    </Link>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/10" />;
}

export default function NavIsland({ onSearch }: { onSearch: () => void }) {
  const { user, logout } = useUser();
  const { mode, setMode } = useAppMode();
  const pathname = usePathname();
  const [modeOpen, setModeOpen] = useState(false);
  const [hoverSearch, setHoverSearch] = useState(false);

  const accent = mode === "anime" ? "#a855f7" : mode === "manhwa" ? "#ef4444" : "#ec4899";
  const read = READ[mode] || READ.anime;
  const is = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 hidden justify-center px-4 lg:flex">
      <nav
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#0b0b12]/85 px-2.5 py-1.5 shadow-[0_10px_40px_rgba(0,0,0,.65)] backdrop-blur-xl"
        style={{ transition: "border-color 300ms" }}
      >
        {/* ── mode ── the one control that changes what everything else means */}
        <div className="relative" onMouseLeave={() => setModeOpen(false)}>
          <button
            onClick={() => setModeOpen((v) => !v)}
            onMouseEnter={() => setModeOpen(true)}
            className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-white/5"
            aria-label="Switch mode"
          >
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 1.5px ${accent}88` }} />
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </button>
          <div
            className="absolute left-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] py-1 shadow-2xl"
            style={{
              transform: `translateY(${modeOpen ? "0" : "-6px"})`,
              opacity: modeOpen ? 1 : 0,
              pointerEvents: modeOpen ? "auto" : "none",
              transition: "opacity 140ms ease, transform 180ms cubic-bezier(.34,1.4,.64,1)",
            }}
          >
            {MODES.map(({ m, label, Icon }) => (
              <button key={m}
                onClick={() => { setMode(m); setModeOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition hover:bg-white/5 ${
                  mode === m ? "text-white" : "text-slate-400"}`}>
                <Icon className="h-4 w-4" /> {label}
                {mode === m && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
              </button>
            ))}
          </div>
        </div>

        <Divider />

        {read.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}

        <Divider />

        {PLAY.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}

        <Divider />

        {SOCIAL.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}

        {user && isAdmin(user.username) && (
          <IslandLink href="/console" label="Console" Icon={Terminal} accent={accent} active={is("/console")} />
        )}

        <Divider />

        {/* search */}
        <button
          onClick={onSearch}
          aria-label="Search"
          onMouseEnter={() => setHoverSearch(true)}
          onMouseLeave={() => setHoverSearch(false)}
          className="relative grid h-10 w-10 place-items-center rounded-full text-slate-400 transition-colors hover:text-white"
        >
          <Search className="h-[18px] w-[18px]" />
          <span aria-hidden
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0b0b12]/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.6)] backdrop-blur"
            style={{
              transform: `translateX(-50%) translateY(${hoverSearch ? "0" : "-4px"}) scale(${hoverSearch ? 1 : 0.94})`,
              opacity: hoverSearch ? 1 : 0,
              transition: "opacity 140ms ease, transform 180ms cubic-bezier(.34,1.4,.64,1)",
            }}>
            Search · Ctrl K
          </span>
        </button>

        {user ? (
          <>
            <IslandLink href="/notifications" label="Notifications" Icon={Bell} accent={accent} active={is("/notifications")} />
            <IslandLink href={`/user/${user.username}`} label={user.username} Icon={Users} accent={accent} active={false} />
            <div className="relative ml-0.5 mr-1 h-8 w-8 shrink-0">
              <Link href={`/user/${user.username}`} aria-label="Your profile">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="relative z-10 h-8 w-8 rounded-full object-cover ring-1 ring-black/60" />
                ) : (
                  <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-purple-700 text-[11px] font-black ring-1 ring-black/60">
                    {(user.username || "?")[0]?.toUpperCase()}
                  </span>
                )}
                <AvatarDecoration frame={(user as any).activeFrame} effect={user.activeEffect} />
              </Link>
            </div>
            <IslandLink href="/settings" label="Settings" Icon={Settings} accent={accent} active={is("/settings")} />
            <button onClick={logout} aria-label="Log out" title="Log out"
              className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:text-rose-400">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </>
        ) : null}
      </nav>
    </div>
  );
}
