"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Activity, Calendar, Users, Layers, Swords, Trophy, Gavel,
  ShoppingBag, Search, Bell, Settings, LogOut, Terminal, BookMarked, BookOpen, Tv,
  ChevronDown, Store, Newspaper, ScrollText, Clock, HelpCircle, LifeBuoy, MoreHorizontal, Castle, Gamepad2,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { isLeadDev } from "@/lib/admin";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import NotificationsMenu from "./NotificationsMenu";

/**
 * NAV ISLAND — the desktop navigation, docked to the bottom.
 *
 * It lives at the bottom because that is where a pointer rests and where a
 * page's content isn't. It stays hidden until you go looking for it, and a thin
 * lit rule along the bottom edge is the thing you aim at — an auto-hiding bar
 * with no visible handle is just a bar people think is broken.
 *
 * Every destination has an icon AND a hover label. Icon-only navigation is a
 * memory test, and this site has too many places to go for that.
 *
 * DESKTOP ONLY (`hidden lg:flex`). It is built on hover, which touch devices do
 * not have; the original top bar keeps `lg:hidden` and is untouched.
 */

type Dest = { href: string; label: string; Icon: any };

const READ: Record<string, Dest[]> = {
  anime: [
    { href: "/", label: "Dashboard", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/airing", label: "Airing Now", Icon: Activity },
    { href: "/calendar", label: "Schedule", Icon: Calendar },
    { href: "/updates", label: "Updates", Icon: Newspaper },
  ],
  manhwa: [
    { href: "/manhwa", label: "Dashboard", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/updates", label: "Updates", Icon: Newspaper },
  ],
  novel: [
    { href: "/novel", label: "Library", Icon: Home },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/updates", label: "Updates", Icon: Newspaper },
  ],
};

/**
 * Everything the island doesn't have room for on the front row.
 *
 * Rebuilding the bar as icons quietly lost five destinations that the old top
 * bar carried — Updates, Upcoming, Quests, Support and FAQ. Updates earned its
 * place back on the row (it was in every mode's links); the rest live behind
 * More, which is better than a row so long it stops being scannable.
 */
const MORE: Dest[] = [
  { href: "/quests", label: "Quests", Icon: ScrollText },
  { href: "/upcoming", label: "Upcoming", Icon: Clock },
  { href: "/faq", label: "FAQ", Icon: HelpCircle },
  { href: "/support", label: "Support", Icon: LifeBuoy },
];

const PLAY: Dest[] = [
  { href: "/cards", label: "Arise Cards", Icon: Layers },
  { href: "/duels", label: "Card Duels", Icon: Swords },
  { href: "/dungeon", label: "Dungeon Dispatch", Icon: Castle },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
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

/** Label sits ABOVE the icon — the bar is at the bottom of the screen. */
function Tip({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#0b0b12]/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.6)] backdrop-blur"
      style={{
        transform: `translateX(-50%) translateY(${show ? "0" : "4px"}) scale(${show ? 1 : 0.94})`,
        opacity: show ? 1 : 0,
        transition: "opacity 130ms ease, transform 170ms cubic-bezier(.34,1.4,.64,1)",
        willChange: "transform, opacity",
      }}
    >
      {children}
    </span>
  );
}

function IslandLink({ href, label, Icon, active, accent }: Dest & { active?: boolean; accent: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 ${
        active ? "text-white" : "text-slate-400 hover:text-white"
      }`}
      style={active
        ? { background: `linear-gradient(140deg, ${accent}55, ${accent}22)`, boxShadow: `inset 0 0 0 1px ${accent}88` }
        : undefined}
    >
      <Icon className="h-[18px] w-[18px]" />
      <Tip show={hover}>{label}</Tip>
    </Link>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/10" />;
}

export default function NavIsland({ onSearch, onSettings }: { onSearch: () => void; onSettings: () => void }) {
  const { user, logout } = useUser();
  const { mode, setMode } = useAppMode();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [hoverSearch, setHoverSearch] = useState(false);
  const [hoverSettings, setHoverSettings] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = mode === "anime" ? "#a855f7" : mode === "manhwa" ? "#ef4444" : "#ec4899";
  const read = READ[mode] || READ.anime;
  const is = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  /**
   * A short close delay, not an instant one. Without it the bar vanishes the
   * moment the pointer crosses a 1px seam between two of its own children, and
   * a menu that flickers while you use it is worse than one that never hides.
   */
  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleHide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setModeOpen(false);
      setMoreOpen(false);
    }, 380);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // The bar is out of the way whenever it isn't wanted — but never while a menu
  // inside it is open, or choosing a mode would dismiss the thing you're using.
  const visible = open || modeOpen || moreOpen || notifOpen;

  return (
    <>
      {/* ── THE HANDLE ── a lit rule along the bottom edge. This is the whole
          reason the auto-hide is usable: it says where to go. Always on, and
          it brightens as the bar comes up so the two read as one gesture. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden justify-center lg:flex"
      >
        <span
          className="h-[3px] w-[min(520px,60vw)] rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            boxShadow: `0 0 14px 2px ${accent}cc, 0 0 34px 6px ${accent}55`,
            opacity: visible ? 0.35 : 1,
            transform: `scaleX(${visible ? 0.72 : 1})`,
            transition: "opacity 240ms ease, transform 280ms cubic-bezier(.4,0,.2,1)",
            willChange: "transform, opacity",
          }}
        />
      </div>

      {/* ── HOVER ZONE ── a 56px band across the bottom. Generous on purpose:
          this is a target you reach for without looking. */}
      <div
        aria-hidden
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className="fixed inset-x-0 bottom-0 z-40 hidden h-14 lg:block"
      />

      {/* ── THE ISLAND ── */}
      <div
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 hidden justify-center px-4 lg:flex"
        style={{
          transform: `translateY(${visible ? "0" : "140%"})`,
          opacity: visible ? 1 : 0,
          transition: "transform 320ms cubic-bezier(.34,1.25,.64,1), opacity 200ms ease",
          willChange: "transform, opacity",
        }}
      >
        <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#0b0b12]/90 px-2.5 py-1.5 shadow-[0_14px_50px_rgba(0,0,0,.7)] backdrop-blur-xl">
          {/* ── mode ── opens UPWARD, with a padding bridge rather than a
              margin. A margin leaves dead space between the button and the
              menu, and crossing it fires mouseleave — which is exactly why
              picking a mode dismissed the menu before the click landed. */}
          <div className="relative" onMouseEnter={() => setModeOpen(true)} onMouseLeave={() => setModeOpen(false)}>
            <button
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-white/5"
              aria-label="Switch mode"
            >
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 1.5px ${accent}88` }} />
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
            <div
              className="absolute bottom-full left-0 z-20 w-44 pb-2.5"
              style={{
                transform: `translateY(${modeOpen ? "0" : "6px"})`,
                opacity: modeOpen ? 1 : 0,
                pointerEvents: modeOpen ? "auto" : "none",
                transition: "opacity 140ms ease, transform 180ms cubic-bezier(.34,1.4,.64,1)",
              }}
            >
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] py-1 shadow-2xl">
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
          </div>

          <Divider />
          {read.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}
          <Divider />
          {PLAY.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}
          <Divider />
          {SOCIAL.map((d) => <IslandLink key={d.href} {...d} accent={accent} active={is(d.href)} />)}
          {/* isLeadDev with the FULL user (role column first, never the
              mutable username), matching the Navbar's gate — isAdmin here
              advertised a console where every button 403s for admins. */}
          {user && isLeadDev(user) && (
            <IslandLink href="/console" label="Console" Icon={Terminal} accent={accent} active={is("/console")} />
          )}

          {/* ── MORE ── opens upward, with a padding bridge rather than a
              margin: a gap between the button and the menu fires mouseleave
              as you reach for it. */}
          <div className="relative" onMouseEnter={() => setMoreOpen(true)} onMouseLeave={() => setMoreOpen(false)}>
            <button aria-label="More"
              className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors ${
                moreOpen ? "text-white" : "text-slate-400 hover:text-white"}`}>
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </button>
            <div className="absolute bottom-full right-0 z-20 w-44 pb-2.5"
              style={{
                transform: `translateY(${moreOpen ? "0" : "6px"})`,
                opacity: moreOpen ? 1 : 0,
                pointerEvents: moreOpen ? "auto" : "none",
                transition: "opacity 140ms ease, transform 180ms cubic-bezier(.34,1.4,.64,1)",
              }}>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f16] py-1 shadow-2xl">
                {MORE.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-bold transition hover:bg-white/5 ${
                      is(href) ? "text-white" : "text-slate-400"}`}>
                    <Icon className="h-4 w-4" /> {label}
                    {is(href) && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Divider />

          <button
            onClick={onSearch}
            aria-label="Search"
            onMouseEnter={() => setHoverSearch(true)}
            onMouseLeave={() => setHoverSearch(false)}
            className="relative grid h-10 w-10 place-items-center rounded-full text-slate-400 transition-colors hover:text-white"
          >
            <Search className="h-[18px] w-[18px]" />
            <Tip show={hoverSearch}>Search · Ctrl K</Tip>
          </button>

          {user && (
            <>
              {/* Neither of these is a PAGE. Notifications is a dropdown and
                  settings opens the Control Center — I had linked both to
                  routes that do not exist, so the bell 404'd. */}
              <div className="grid h-10 w-10 place-items-center">
                <NotificationsMenu openUp onOpenChange={setNotifOpen} />
              </div>
              <button onClick={onSettings} aria-label="Control Center"
                onMouseEnter={() => setHoverSettings(true)}
                onMouseLeave={() => setHoverSettings(false)}
                className="relative grid h-10 w-10 place-items-center rounded-full text-slate-400 transition-colors hover:text-white">
                <Settings className="h-[18px] w-[18px]" />
                <Tip show={hoverSettings}>Control Center</Tip>
              </button>
              {/* The avatar IS the profile link — there was a second one beside
                  it doing the same job, which just made you choose between two
                  identical doors. */}
              <ProfileDot user={user} />
              <button onClick={logout} aria-label="Log out"
                className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:text-rose-400">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  );
}

function ProfileDot({ user }: { user: any }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/user/${user.username}`}
      aria-label="Your profile"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative ml-0.5 mr-1 h-8 w-8 shrink-0"
    >
      {user.avatar ? (
        <img src={user.avatar} alt="" className="relative z-10 h-8 w-8 rounded-full object-cover ring-1 ring-black/60" />
      ) : (
        <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-purple-700 text-[11px] font-black ring-1 ring-black/60">
          {(user.username || "?")[0]?.toUpperCase()}
        </span>
      )}
      <AvatarDecoration frame={user.activeFrame} effect={user.activeEffect} />
      <Tip show={hover}>{user.username}</Tip>
    </Link>
  );
}
