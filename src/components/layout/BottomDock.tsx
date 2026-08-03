"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Bell, X, Search, Settings, LogOut,
  Tv, BookOpen, Feather, Layers, Swords, Castle, FlaskConical,
  Store, Gavel, Users, Trophy, ShoppingBag, Megaphone,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";

/**
 * THE DOCK — a floating pill of the six controls a thumb actually wants,
 * pinned to the bottom on phones. Tapping HOME doesn't navigate — it opens
 * the Navigation sheet: quick actions up top, every corner of Da Vinci
 * below, each behind its own coloured tile.
 *
 * Mobile-first by design (`lg:hidden`): desktop already has the island.
 */

const PAGES: { href: string; label: string; Icon: any; tint: string }[] = [
  { href: "/",            label: "Anime Home",       Icon: Tv,           tint: "#a274ff" },
  { href: "/manhwa",      label: "Manhwa Home",      Icon: BookOpen,     tint: "#38bdf8" },
  { href: "/novel",       label: "Novel Home",       Icon: Feather,      tint: "#fbbf24" },
  { href: "/cards",       label: "Arise Cards",      Icon: Layers,       tint: "#c084fc" },
  { href: "/duels",       label: "Card Duels",       Icon: Swords,       tint: "#f43f5e" },
  { href: "/dungeon",     label: "Dungeon Dispatch", Icon: Castle,       tint: "#5fd18a" },
  { href: "/forge",       label: "Synthesis Lab",    Icon: FlaskConical, tint: "#ef4444" },
  { href: "/marketplace", label: "Marketplace",      Icon: Store,        tint: "#22d3ee" },
  { href: "/auctions",    label: "Auction House",    Icon: Gavel,        tint: "#f59e0b" },
  { href: "/community",   label: "Community",        Icon: Users,        tint: "#34d399" },
  { href: "/quests",      label: "Daily Quests",     Icon: Trophy,       tint: "#fb923c" },
  { href: "/shop",        label: "Shop",             Icon: ShoppingBag,  tint: "#e879f9" },
  { href: "/leaderboard", label: "Leaderboard",      Icon: Trophy,       tint: "#7dd3fc" },
  { href: "/updates",     label: "Updates",          Icon: Megaphone,    tint: "#94a3b8" },
];

export default function BottomDock({
  onSearch,
  onSettings,
}: {
  /** Opens the real search modal (owned by the nav that mounts us). */
  onSearch?: () => void;
  /** Opens the Control Center — quick settings, performance mode. */
  onSettings?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);

  // Reader screens hide all chrome; the dock respects that.
  if (pathname?.includes("/chapter/")) return null;

  const DockBtn = ({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) => (
    <button onClick={onClick} aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-90">
      {children}
    </button>
  );

  return (
    <>
      {/* ── the pill ── */}
      <div className="fixed inset-x-0 z-[75] flex justify-center lg:hidden"
        style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-1 rounded-full px-3 py-1.5"
          style={{ background: "rgba(10,9,15,.92)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10), 0 10px 34px rgba(0,0,0,.65)", backdropFilter: "blur(10px)" }}>
          <DockBtn onClick={() => router.back()} label="Back"><ArrowLeft className="h-[18px] w-[18px]" /></DockBtn>
          <DockBtn onClick={() => router.forward()} label="Forward"><ArrowRight className="h-[18px] w-[18px]" /></DockBtn>
          <DockBtn onClick={() => window.location.reload()} label="Reload"><RotateCw className="h-[17px] w-[17px]" /></DockBtn>
          <DockBtn onClick={() => setOpen(true)} label="Navigation"><Home className="h-[18px] w-[18px]" /></DockBtn>
          <DockBtn onClick={() => router.push("/updates")} label="Updates"><Bell className="h-[18px] w-[18px]" /></DockBtn>
          {user && (
            <button onClick={() => router.push(`/user/${user.username}`)} aria-label="Your profile"
              className="ml-0.5 grid h-9 w-9 place-items-center overflow-hidden rounded-full transition active:scale-90"
              style={{ boxShadow: "inset 0 0 0 1.5px rgba(162,116,255,.6)" }}>
              {user.avatar
                ? <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                : <span className="text-xs font-black text-purple-200">{user.username?.[0]?.toUpperCase()}</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── the navigation sheet ── */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center lg:hidden"
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
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  ["Search", Search, () => { setOpen(false); if (onSearch) onSearch(); else router.push("/explore"); }],
                  ["Settings", Settings, () => { setOpen(false); if (onSettings) onSettings(); }],
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
                {PAGES.map(({ href, label, Icon, tint }) => (
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
