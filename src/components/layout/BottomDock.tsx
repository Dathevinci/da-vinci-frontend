"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, RotateCw, Home, X, Search, LogOut, SlidersHorizontal,
  Tv, BookOpen, Feather, Layers, Swords,
  Store, Users, Trophy, ShoppingBag, Megaphone,
  Compass, Activity, Calendar, Clock, HelpCircle, Heart, Terminal, LayoutGrid, Stamp } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { isLeadDev } from "@/lib/admin";
// The dock avatar is 36px; serve it at that scale instead of the original
// upload (animated uploads pass through untouched — see cloudinary.ts).
import { cloudinaryFit } from "@/lib/cloudinary";
import NotificationsMenu from "./NotificationsMenu";
import GuildChatDock from "@/components/guild/GuildChatDock";

/**
 * THE DOCK — a floating pill of the six controls a thumb actually wants,
 * pinned to the bottom. Tapping HOME doesn't navigate — it opens the
 * Navigation sheet: quick actions up top, every corner of Da Vinci below,
 * each behind its own coloured tile.
 *
 * EVERY screen size, by the owner's ask: this replaced the hover island as
 * the signed-in desktop navigation too, so the sheet must carry every
 * destination the island had — nothing may exist only behind a hover.
 */

const PAGES: { href: string; label: string; Icon: any; tint: string }[] = [
  { href: "/hub",         label: "The Hub",          Icon: LayoutGrid,   tint: "#8b5cf6" },
  { href: "/",            label: "Anime Home",       Icon: Tv,           tint: "#a274ff" },
  { href: "/manhwa",      label: "Manhwa Home",      Icon: BookOpen,     tint: "#38bdf8" },
  { href: "/novel",       label: "Novel Home",       Icon: Feather,      tint: "#fbbf24" },
  // One row per mode's own explore. The dock is a flat list of every
  // destination rather than a mode-aware menu, so all three are listed —
  // previously only anime's was here, which made the comics and novel
  // explores unreachable for anyone signed in (the mode-aware bar below is
  // guests-only).
  { href: "/explore",         label: "Explore Anime",    Icon: Compass,      tint: "#818cf8" },
  { href: "/manhwa/explore",  label: "Explore Comics",   Icon: Compass,      tint: "#38bdf8" },
  { href: "/novel/explore",   label: "Explore Novels",   Icon: Compass,      tint: "#fbbf24" },
  { href: "/airing",      label: "Airing Now",       Icon: Activity,     tint: "#4ade80" },
  { href: "/calendar",    label: "Schedule",         Icon: Calendar,     tint: "#f472b6" },
  { href: "/cards",       label: "Arise Cards",      Icon: Layers,       tint: "#c084fc" },
  { href: "/duels",       label: "Card Duels",       Icon: Swords,       tint: "#f43f5e" },
  { href: "/raid",        label: "World Raid",       Icon: Swords,       tint: "#f87171" },
  { href: "/guilds",      label: "Guilds",           Icon: Users,        tint: "#10b981" },
  { href: "/marketplace", label: "Marketplace",      Icon: Store,        tint: "#22d3ee" },
  { href: "/community",   label: "Community",        Icon: Users,        tint: "#34d399" },
  { href: "/quests",      label: "Daily Quests",     Icon: Trophy,       tint: "#fb923c" },
  { href: "/shop",        label: "Shop",             Icon: ShoppingBag,  tint: "#e879f9" },
  { href: "/leaderboard", label: "Leaderboard",      Icon: Trophy,       tint: "#7dd3fc" },
  { href: "/stamps",      label: "Stamps",           Icon: Stamp,        tint: "#fbbf24" },
  { href: "/upcoming",    label: "Upcoming",         Icon: Clock,        tint: "#c4b5fd" },
  { href: "/updates",     label: "Updates",          Icon: Megaphone,    tint: "#94a3b8" },
  { href: "/faq",         label: "FAQ",              Icon: HelpCircle,   tint: "#93c5fd" },
  { href: "/support",     label: "Support Us",       Icon: Heart,        tint: "#fda4af" },
];

/**
 * ONE DOCK BUTTON. Hoisted to module scope on purpose: defined inside
 * BottomDock it became a NEW component type on every render, so React
 * remounted every button each time the hover state changed — which is
 * exactly when the animation needs the elements to persist.
 *
 * The lit pill behind the hovered icon is a single shared element
 * (layoutId), so it SLIDES from icon to icon instead of blinking out and
 * in, and the icon itself lifts and grows a little as it takes over.
 */
function DockBtn({
  id, hovered, setHovered, reduce, onClick, label, children,
}: {
  id: string;
  hovered: string | null;
  setHovered: (v: string | null) => void;
  reduce: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const on = hovered === id;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHovered(id)}
      onFocus={() => setHovered(id)}
      onBlur={() => setHovered(null)}
      className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors active:scale-90 ${
        on ? "text-white" : "text-slate-300"
      }`}
    >
      {on && !reduce && (
        <motion.span
          layoutId="dock-glow"
          transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.6 }}
          className="absolute inset-0 rounded-full"
          style={{ background: "rgba(255,255,255,.12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
        />
      )}
      {on && reduce && <span className="absolute inset-0 rounded-full bg-white/10" />}
      <motion.span
        className="relative flex"
        animate={reduce ? { y: 0, scale: 1 } : { y: on ? -2.5 : 0, scale: on ? 1.14 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 24, mass: 0.5 }}
      >
        {children}
      </motion.span>
    </button>
  );
}

export default function BottomDock({
  onSearch,
  onSettings,
  pin,
}: {
  /** Opens the real search modal (owned by the nav that mounts us). */
  onSearch?: () => void;
  /** Toggles the Control Center — quick settings, performance mode. */
  onSettings?: () => void;
  /** True while something anchored to the bar (the Control Center) is
   *  open — keeps the scroll auto-hide from sliding the bar out from
   *  under its own panel. */
  pin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const reduce = useReducedMotion();

  /**
   * READING HIDES IT, REACHING BRINGS IT BACK.
   *
   * Scroll down and the bar drops away; scroll up — the gesture you make
   * when you want navigation — and it returns. It always returns near the
   * top of a page, and on any route change.
   *
   * ONLY the page scroller drives this, deliberately. Watching every
   * internal scroller (overlays, modals, carousels) sounds more thorough
   * and is a trap: a container that hid the bar can UNMOUNT — close a
   * modal you scrolled — and then nothing is left to scroll back up, so
   * the only navigation a signed-in user has stays hidden with no gesture
   * to recover it. Horizontal carousels made it worse still, reporting
   * scrollTop 0 so every sideways swipe yanked the bar back.
   *
   * Surfaces that scroll internally lock the page scroll anyway, so the
   * bar simply stays visible over them — which is where you want
   * navigation most.
   */
  useEffect(() => {
    // Never hide while something anchored to the bar is open.
    if (open || notifOpen || pin) { setHidden(false); return; }

    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) { lastY = y; setHidden(false); return; }  // near the top: always shown
      const delta = y - lastY;
      if (Math.abs(delta) < 8) return;                      // ignore jitter and rubber-band
      lastY = y;
      setHidden(delta > 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, notifOpen, pin]);

  // A route change always restores it — otherwise you could land on a new
  // page with no navigation until you happened to scroll up.
  useEffect(() => { setHidden(false); }, [pathname]);

  // Reader screens hide all chrome; the dock respects that.
  if (pathname?.includes("/chapter/")) return null;

  const btn = (id: string) => ({
    id, hovered, setHovered, reduce: !!reduce,
  });

  return (
    <>
      {/* ── the pill ── */}
      <div className="fixed inset-x-0 z-[75] flex justify-center"
        style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))" }}>
        {/* NO backdrop-filter here — besides being against this app's perf
            rules, it makes the pill the CONTAINING BLOCK for every fixed
            descendant, which shrank the notifications panel to pill width
            and trapped it inside the pill. The near-opaque bg reads the
            same without the blur. */}
        {/* ONE style prop. Two of them meant the later object won and the
            pointerEvents rule was silently dropped — and since the
            reduced-motion path only fades (no slide), that left an
            invisible bar parked over the page still catching taps, Reload
            included. `visibility` at the end of the animation takes it out
            of hit-testing AND the tab order, so a keyboard user can't land
            on a bar they can't see either. */}
        <motion.div
          initial={reduce ? false : { y: 28, opacity: 0 }}
          animate={{
            y: reduce ? 0 : hidden ? 110 : 0,
            opacity: hidden ? 0 : 1,
            ...(hidden
              ? { transitionEnd: { visibility: "hidden" as const } }
              : { visibility: "visible" as const }),
          }}
          transition={reduce
            ? { duration: 0.15 }
            : { type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
          onMouseLeave={() => setHovered(null)}
          aria-hidden={hidden}
          className="flex items-center gap-1 rounded-full px-3 py-1.5"
          style={{
            pointerEvents: hidden ? "none" : "auto",
            background: "rgba(10,9,15,.95)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10), 0 10px 34px rgba(0,0,0,.65)",
          }}>
          <DockBtn {...btn("back")} onClick={() => router.back()} label="Back"><ArrowLeft className="h-[18px] w-[18px]" /></DockBtn>
          <DockBtn {...btn("fwd")} onClick={() => router.forward()} label="Forward"><ArrowRight className="h-[18px] w-[18px]" /></DockBtn>
          <DockBtn {...btn("reload")} onClick={() => window.location.reload()} label="Reload"><RotateCw className="h-[17px] w-[17px]" /></DockBtn>
          <DockBtn {...btn("nav")} onClick={() => setOpen(true)} label="Navigation"><Home className="h-[18px] w-[18px]" /></DockBtn>
          {/* Control Center, ON the bar — it was buried behind the sheet's
              Quick actions, two taps deep for the panel you reach for most.
              data-cc-trigger (display:contents, no layout box) lets the
              panel's click-outside ignore this button so it can TOGGLE. */}
          <span data-cc-trigger className="contents">
            <DockBtn {...btn("cc")} onClick={() => { if (onSettings) onSettings(); }} label="Control Center"><SlidersHorizontal className="h-[17px] w-[17px]" /></DockBtn>
          </span>
          {/* GUILD CHAT — the same room the guild hall renders, reachable from
              anywhere. Renders NOTHING (button and pollers alike) for anyone
              without a guild, so the pill is unchanged for everyone else. It
              takes the pill's hover state so the lit backdrop slides onto it
              like any other button; its panel portals to the body, because a
              mid-animation transform on this pill would otherwise become the
              containing block for a full-screen fixed sheet. */}
          <GuildChatDock hovered={hovered} setHovered={setHovered} reduce={!!reduce} />
          {/* the REAL notifications panel, unread badge and all — this bell
              used to just route to /updates, which is a page, not your
              notifications. Updates still lives in the sheet's page list. */}
          {/* the bell and the avatar aren't DockBtns, so they must clear the
              glow themselves — otherwise it stayed stranded on whichever
              icon you left as the pointer moved onto them */}
          <div className="grid h-10 w-10 place-items-center" onMouseEnter={() => setHovered(null)}>
            {/* onOpenChange keeps the bar pinned while the panel is open —
                the panel is anchored to the bell, so hiding the bar under
                it would leave it floating over nothing. */}
            <NotificationsMenu openUp onOpenChange={setNotifOpen} />
          </div>
          {user && (
            <button onClick={() => router.push(`/user/${user.username}`)} aria-label="Your profile"
              onMouseEnter={() => setHovered(null)}
              className="ml-0.5 grid h-9 w-9 place-items-center overflow-hidden rounded-full transition active:scale-90"
              style={{ boxShadow: "inset 0 0 0 1.5px rgba(162,116,255,.6)" }}>
              {user.avatar
                ? <img src={cloudinaryFit(user.avatar, 80)} alt="" className="h-full w-full object-cover" />
                : <span className="text-xs font-black text-purple-200">{user.username?.[0]?.toUpperCase()}</span>}
            </button>
          )}
        </motion.div>
      </div>

      {/* ── the navigation sheet ── */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-y-auto rounded-3xl p-5"
              style={{ maxHeight: "82dvh", background: "#0d0c12", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08), 0 20px 60px rgba(0,0,0,.7)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-lg font-bold text-white">Navigation</h3>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">Quick actions &amp; pages</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
              {/* Settings moved OUT of here onto the dock pill itself. */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  ["Search", Search, () => { setOpen(false); if (onSearch) onSearch(); else router.push("/explore"); }],
                  ["Reload", RotateCw, () => window.location.reload()],
                ] as const).map(([label, Icon, fn]) => (
                  <button key={label as string} onClick={fn as () => void}
                    className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition hover:bg-white/5"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl"
                      style={{ background: "rgba(45,212,191,.10)", boxShadow: "inset 0 0 0 1px rgba(45,212,191,.25)" }}>
                      <Icon className="h-[18px] w-[18px] text-teal-300" />
                    </span>
                    <span className="font-mono text-xs text-slate-300">{label as string}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Navigate</p>
              <div className="mt-2 flex flex-col">
                {/* Console rides along only for the lead dev — role column,
                    never the username, same gate as everywhere else. */}
                {[...PAGES, ...(user && isLeadDev(user)
                  ? [{ href: "/console", label: "Console", Icon: Terminal, tint: "#a3e635" }]
                  : [])].map(({ href, label, Icon, tint }) => (
                  <Link key={href + label} href={href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl px-2 py-2.5 transition hover:bg-white/5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                      style={{ background: `${tint}1a`, boxShadow: `inset 0 0 0 1px ${tint}40` }}>
                      <Icon className="h-4 w-4" style={{ color: tint }} />
                    </span>
                    <span className={`font-mono text-sm font-bold ${pathname === href ? "text-white" : "text-slate-300"}`}>{label}</span>
                    {pathname === href && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: tint }} />}
                  </Link>
                ))}
              </div>

              {/* the way out — the old hamburger's logout lives here now */}
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 py-3.5 font-mono text-sm font-bold text-red-400 transition hover:bg-red-500/20">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
