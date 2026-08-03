"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, Users, User as UserIcon, Megaphone, BookOpen,
  MoreHorizontal, X, Store, Layers, Swords, ShoppingBag, Target, HelpCircle, Heart, Sparkles,
  Trophy, Gavel, Castle, Gamepad2,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useAppMode } from "@/components/providers/AppModeProvider";

/**
 * MOBILE BOTTOM NAV.
 *
 * The bar itself only ever holds FIVE slots — four routes plus More. Anything
 * beyond that stops being a tap target and starts being a guess, which is why
 * the card game could not simply be appended: marketplace, cards, duels and
 * the shop had no entry on a phone at all, so an entire half of the site was
 * unreachable unless you typed the URL.
 *
 * They live in a More sheet instead. It carries every route the desktop nav
 * island has and the bar stays four-wide and thumb-sized.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { mode } = useAppMode();
  const [more, setMore] = useState(false);

  // Signed-in phones run the DOCK now (BottomDock, mounted by the Navbar).
  // Two bottom navs stacked was the bug; this bar stays only for guests,
  // who have no dock and still need somewhere to tap.
  if (user) return null;

  const accentColor = mode === "anime" ? "text-purple-400" : mode === "manhwa" ? "text-red-500" : "text-pink-400";
  const bgBadge =
    mode === "anime"
      ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
      : mode === "manhwa"
      ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"
      : "bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]";

  const home =
    mode === "anime"
      ? { label: "Home", href: "/", icon: <Home className="h-6 w-6" /> }
      : mode === "manhwa"
      ? { label: "Home", href: "/manhwa", icon: <Home className="h-6 w-6" /> }
      : { label: "Library", href: "/novel", icon: <BookOpen className="h-6 w-6" /> };

  // Four routes plus More. Explore is anime-only, so the other two modes get
  // Updates in that slot rather than a gap.
  const navItems = [
    home,
    mode === "anime"
      ? { label: "Explore", href: "/explore", icon: <Compass className="h-6 w-6" /> }
      : { label: "Updates", href: "/updates", icon: <Megaphone className="h-6 w-6" /> },
    { label: "Community", href: "/community", icon: <Users className="h-6 w-6" /> },
    { label: "Profile", href: user ? `/user/${user.username}` : "/user/login", icon: <UserIcon className="h-6 w-6" /> },
  ];

  /** Everything the bar has no room for. Mirrors the desktop nav island. */
  const moreLinks = [
    { label: "Marketplace", href: "/marketplace", icon: Store, hint: "Buy and sell cards" },
    { label: "Arise Cards", href: "/cards", icon: Layers, hint: "Your collection" },
    { label: "Card Duels", href: "/duels", icon: Swords, hint: "Stake and fight" },
    { label: "Dungeon Dispatch", href: "/dungeon", icon: Castle, hint: "Send a party in" },
    { label: "Arise Shop", href: "/shop", icon: ShoppingBag, hint: "Frames and effects" },
    { label: "Quests", href: "/quests", icon: Target, hint: "Daily rewards" },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy, hint: "Who is winning" },
    { label: "Auction House", href: "/auctions", icon: Gavel, hint: "Bid on cards" },
    { label: "Updates", href: "/updates", icon: Megaphone, hint: "What changed" },
    { label: "Upcoming", href: "/upcoming", icon: Sparkles, hint: "What's next" },
    { label: "FAQ", href: "/faq", icon: HelpCircle, hint: "How things work" },
    { label: "Support Us", href: "/support", icon: Heart, hint: "Keep the lights on" },
  ];

  // Hide on immersive chapter readers so it doesn't cover their controls.
  if (pathname && pathname.includes("/chapter/")) return null;

  /**
   * A route is active when the path IS it or sits under it. Matching on
   * equality alone meant Profile never lit up (the path is /user/<name>) and
   * neither did any sub-page, so the bar spent most of its time showing
   * nothing selected.
   */
  const isOn = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname && (pathname === href || pathname.startsWith(href + "/"));

  const moreActive = moreLinks.some((l) => isOn(l.href));

  return (
    <>
      {/* ── MORE SHEET ── */}
      {more && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[76dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b0b12] pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#0b0b12] px-5 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Everything else</span>
              <button onClick={() => setMore(false)} aria-label="Close" className="text-slate-500 transition hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              {moreLinks.map((l) => {
                const Icon = l.icon;
                const on = isOn(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMore(false)}
                    className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                      on ? "border-purple-400/50 bg-purple-500/12" : "border-white/10 bg-white/[0.03] active:bg-white/10"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${on ? accentColor : "text-slate-400"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">{l.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">{l.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        id="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#09090b]/90 backdrop-blur-xl pb-safe md:hidden"
      >
        <div className="flex h-16 items-center justify-around px-1">
          {navItems.map((item) => {
            const isActive = isOn(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex h-full w-full flex-col items-center justify-center space-y-1 transition-colors ${
                  isActive ? accentColor : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <div className={`relative ${isActive ? "scale-110 transition-transform" : ""}`}>
                  {item.icon}
                  {isActive && <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${bgBadge}`} />}
                </div>
                <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMore(true)}
            aria-label="More"
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 transition-colors ${
              moreActive || more ? accentColor : "text-slate-500"
            }`}
          >
            <div className={`relative ${moreActive || more ? "scale-110 transition-transform" : ""}`}>
              <MoreHorizontal className="h-6 w-6" />
              {moreActive && <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${bgBadge}`} />}
            </div>
            <span className="text-[10px] font-bold tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
