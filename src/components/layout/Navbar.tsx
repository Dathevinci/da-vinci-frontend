"use client";

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Compass, Calendar, Activity, User as UserIcon, LogOut, Users, Palette, ShoppingBag, Menu, X, Settings, Heart, ChevronDown, Tv, BookMarked, BookOpen } from 'lucide-react';
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import LoginModal from './LoginModal';
import SearchModal from './SearchModal';
import ArisePointPopup from '../ui/ArisePointPopup';
import ControlCenter from './ControlCenter';
import NotificationsMenu from './NotificationsMenu';
import { useUser } from '@/hooks/useUser';
import { usePreferences } from '@/hooks/usePreferences';
import { useAppMode } from '@/components/providers/AppModeProvider';
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { StaticDecoration } from "@/components/profile/StaticDecoration";
import { useEffectSlot } from "@/components/profile/useEffectSlot";
import { EffectSwitcher } from "@/components/profile/EffectSwitcher";
import { getEffectMeta, TIER_CHIP } from "@/lib/effectMeta";
import { effectNameClass, effectCardBorderClass } from "@/lib/effectTheme";
import { nameColorClass } from "@/lib/cosmetics";

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  const { user, isLoaded, logout } = useUser();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();

  const [prevPoints, setPrevPoints] = useState<number | null>(null);
  const [popupData, setPopupData] = useState<{ amount: number } | null>(null);

  const isDejavuh = isLeadDev(user);

  useEffect(() => {
    if (user && user.arisePoints !== undefined) {
      if (prevPoints !== null && user.arisePoints > prevPoints) {
        const gained = user.arisePoints - prevPoints;
        setPopupData({ amount: gained });
        setTimeout(() => setPopupData(null), 4000);
      }
      setPrevPoints(user.arisePoints);
    }
  }, [user?.arisePoints]);

  useEffect(() => {
    // Throttle with requestAnimationFrame and only update state when the
    // boolean actually flips — the old handler called setState on every
    // scroll event, re-rendering the blur-heavy header and causing jank.
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setIsScrolled((prev) => {
          const next = window.scrollY > 20;
          return prev === next ? prev : next;
        });
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { mode, setMode } = useAppMode();
  const pathname = usePathname();

  // Theming variables based on mode (anime = amethyst, manhwa = crimson, novel = pink)
  const accentText = mode === 'anime' ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : mode === 'manhwa' ? 'text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'text-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]';
  const accentHover = mode === 'anime' ? 'hover:text-purple-400' : mode === 'manhwa' ? 'hover:text-red-500' : 'hover:text-pink-400';
  const accentBorder = mode === 'anime' ? 'border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : mode === 'manhwa' ? 'border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'border-pink-400/50 shadow-[0_0_15px_rgba(236,72,153,0.4)]';
  const modeLabelColor = mode === 'anime' ? 'text-purple-400' : mode === 'manhwa' ? 'text-red-500' : 'text-pink-400';

  // Desktop Links
  const animeLinks = (
    <>
      <Link href="/" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Dashboard</Link>
      <Link href="/explore" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Explore</Link>
      <div className="relative group">
        <button className={`hover:text-white ${accentHover} transition flex items-center gap-1`}>
          Discover <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
        </button>
        {/* pt-3 = a flush transparent hover bridge (see the "More" menu below);
            replaces the old mt-6 dead gap that closed the menu mid-reach. */}
        <div className="absolute top-full left-0 w-48 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
          <div className="bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl flex flex-col overflow-hidden py-2">
            <Link href="/airing" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Activity className="w-4 h-4" /> Airing Now</Link>
            <Link href="/upcoming" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Compass className="w-4 h-4" /> Upcoming</Link>
            <Link href="/calendar" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Calendar className="w-4 h-4" /> Schedule</Link>
          </div>
        </div>
      </div>
      <Link href="/updates" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Updates</Link>
    </>
  );

  const manhwaLinks = (
    <>
      <Link href="/manhwa" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Dashboard</Link>
      <Link href="/updates" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Updates</Link>
    </>
  );

  const novelLinks = (
    <>
      <Link href="/novel" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Library</Link>
      <Link href="/updates" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Updates</Link>
    </>
  );

  const MODE_OPTIONS = [
    { m: 'anime' as const, label: 'Anime', cls: 'text-purple-400', Icon: Tv },
    { m: 'manhwa' as const, label: 'Manhwa', cls: 'text-red-500', Icon: BookMarked },
    { m: 'novel' as const, label: 'Novels', cls: 'text-pink-400', Icon: BookOpen },
  ];

  // ── Profile menu ────────────────────────────────────────────────────────
  // Derived ABOVE the /chapter/ early return — hooks must run unconditionally.
  const slot = useEffectSlot();
  const effectiveEffect = slot.effective;
  const effectMeta = getEffectMeta(effectiveEffect);
  // Render the static decoration until preferences load, never the reverse:
  // one imperceptible tick for everyone, vs. a frame of animation flashing at
  // exactly the users who turned it off.
  const animate = prefsLoaded && !preferences.reducedMotion;
  const nameClass =
    nameColorClass((user as any)?.activeColor) ||
    effectNameClass(effectiveEffect) ||
    (isAdmin(user) ? 'text-purple-300' : 'text-slate-200');

  // Close on outside pointerdown + on scroll. Gated on `open` so no listener
  // exists while closed. Matches NotificationsMenu exactly — and because each
  // menu's outside-handler fires on the other's trigger, the two are mutually
  // exclusive without any coordinating state.
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const onScroll = () => setProfileMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        profileTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [profileMenuOpen]);

  useEffect(() => { setProfileMenuOpen(false); }, [pathname]);

  // Roving focus. The generic on querySelectorAll is required — a bare call
  // yields Element, which has no .focus(), and ignoreBuildErrors would let that
  // ship as a runtime TypeError.
  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(
      profileMenuRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]:not([disabled])') || []
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    // i === -1 means focus is on the trigger (or a non-item link). Treat that as
    // "before the list": ArrowDown -> first, ArrowUp -> last. The naive modulo
    // sent ArrowUp to the SECOND-to-last item.
    const next =
      e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : i === -1 ? (e.key === 'ArrowDown' ? 0 : items.length - 1)
      : e.key === 'ArrowDown' ? (i + 1) % items.length
      : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  // Immersive readers (manhwa/novel chapter pages) render their own top bar —
  // hide the global navbar so it doesn't overlap them.
  if (pathname && pathname.includes('/chapter/')) return null;

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? `bg-[#030305]/90 backdrop-blur-lg border-b ${isDejavuh ? 'border-purple-500/30 shadow-[0_4px_30px_rgba(168,85,247,0.15)]' : 'border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}`
          : 'bg-gradient-to-b from-[#030305]/80 to-transparent'
      }`}>
        <div className={`container mx-auto px-4 sm:px-6 flex justify-between items-center transition-all duration-300 ${isScrolled ? 'h-16' : 'h-20 lg:h-24'}`}>
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href={mode === 'anime' ? "/" : mode === 'manhwa' ? "/manhwa" : "/novel"} className="font-fell font-bold text-xl sm:text-2xl lg:text-3xl text-white tracking-[0.1em] sm:tracking-[0.2em] uppercase flex items-center gap-2 sm:gap-3 drop-shadow-lg shrink-0">
              <img src="/logo.png" alt="Da Vinci Logo" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border ${accentBorder} object-cover transition-colors`} />
              <span className="hidden xs:inline-block">DA <span className={`font-black ${accentText} transition-colors`}>VINCI</span></span>
            </Link>

            {/* Mode Switcher — 3-way dropdown (Anime / Manhwa / Novels) */}
            <div className="relative shrink-0">
              <button
                onClick={() => setModeMenuOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Switch mode"
              >
                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${modeLabelColor}`}>
                  {mode === 'anime' ? 'Anime' : mode === 'manhwa' ? 'Manhwa' : 'Novels'} Mode
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${modeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {modeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModeMenuOpen(false)} />
                  <div className="absolute left-0 mt-2 w-40 z-50 bg-[#0f0f11] border border-white/10 rounded-xl shadow-2xl p-1.5">
                    {MODE_OPTIONS.map(({ m, label, cls, Icon }) => (
                      <button
                        key={m}
                        onClick={() => { setModeMenuOpen(false); setMode(m); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${mode === m ? `bg-white/10 ${cls}` : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <nav className="hidden lg:flex gap-4 xl:gap-6 font-medium text-sm text-slate-300 shrink-0">
              {mode === 'anime' ? animeLinks : mode === 'manhwa' ? manhwaLinks : novelLinks}
              
              <div className="relative group">
                <button className={`hover:text-white ${accentHover} transition flex items-center gap-1`}>
                  More <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                </button>
                {/* The pt-3 on this wrapper is a transparent hover "bridge" that
                    sits flush under the button — so moving the cursor down into the
                    menu never crosses a dead gap that snaps it shut. The old design
                    used an mt-6 margin (a real 24px gap) with a :before bridge that
                    never rendered (Tailwind pseudo-elements need content-['']), so
                    it closed on people mid-reach depending on cursor speed. */}
                <div className="absolute top-full left-0 w-48 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl flex flex-col overflow-hidden py-2">
                    <Link href="/community" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Users className="w-4 h-4" /> Community</Link>
                    <Link href="/shop" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><ShoppingBag className="w-4 h-4" /> Shop</Link>
                    <Link href="/support" className="px-4 py-2 hover:bg-white/5 text-[#ff5e5b] hover:text-[#ff4542] transition flex items-center gap-2"><Heart className="w-4 h-4" /> Support Us</Link>
                  </div>
                </div>
              </div>
            </nav>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 text-slate-300 shrink-0">
            <button onClick={() => setShowSearchModal(true)} className="hover:text-purple-400 transition transform hover:scale-110 flex items-center gap-2">
              <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="hidden lg:flex items-center gap-1 text-xs font-medium bg-white/10 px-2 py-0.5 rounded text-slate-400 border border-white/5 shadow-inner">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
              </span>
            </button>
            
            <div className="lg:hidden flex items-center">
              <NotificationsMenu />
            </div>
            
            {isLoaded && (
              user ? (
                <div className="hidden lg:flex items-center gap-3 xl:gap-4 shrink-0">
                  {/* The ref wraps ONLY trigger + panel so the outside-pointerdown
                      handler treats the notification bell as "outside". */}
                  {/* onKeyDown lives HERE, not on the panel: the trigger is the
                      panel's sibling, so a handler on the panel never sees
                      trigger keydowns — ArrowDown would fall through to the
                      page, scroll it, and the scroll listener would close the
                      menu the user had just opened. */}
                  <div className="relative" ref={profileMenuRef} onKeyDown={handleMenuKeyDown}>
                    <button
                      type="button"
                      ref={profileTriggerRef}
                      onClick={() => { setShowControlCenter(false); setProfileMenuOpen(v => !v); }}
                      aria-haspopup="menu"
                      aria-expanded={profileMenuOpen}
                      aria-controls="profile-menu"
                      aria-label={`Account menu for ${user.username}`}
                      className="group flex items-center gap-2 h-10 pl-1.5 pr-2 xl:pr-3 text-sm font-bold bg-white/10 hover:bg-white/[0.16] border border-white/10 rounded-full transition-colors duration-150 shadow-lg text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                    >
                      {/* gpu-layer keeps the always-running glow from repainting
                          the blur-heavy header on every frame. */}
                      <span className="relative inline-flex shrink-0 gpu-layer">
                        <img src={user.avatar || FALLBACK_AVATAR} alt="" className="relative z-10 w-7 h-7 rounded-full object-cover" />
                        {animate
                          ? <AvatarDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />
                          : <StaticDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />}
                      </span>
                      <span className={`hidden xl:inline max-w-[14ch] truncate
                        ${user.activeFont === 'font_cyber' ? 'font-mono tracking-widest' : ''}
                        ${user.activeFont === 'font_pixel' ? 'font-serif tracking-tight' : ''}
                        ${nameClass}`}>
                        {user.username}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* NOTE: no live <ProfileEffect> renders in this menu, at any
                        size, deliberately. Two effects play audio on mount
                        (MahoragaRitual, VerdantCanopy) — opening a menu is a user
                        gesture, so autoplay succeeds and a summon chant fires
                        every time you click your own avatar. And 15 effect files
                        centre themselves on the largest anchor in the DOCUMENT,
                        so a header instance mis-centres or paints nothing.
                        The identity here is static gradients. Keep it that way. */}
                    <AnimatePresence>
                      {profileMenuOpen && (
                        <motion.div
                          id="profile-menu"
                          role="menu"
                          aria-label="Profile menu"
                          initial={{ opacity: 0, scale: 0.96, y: -8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -8 }}
                          transition={animate ? { type: 'spring', stiffness: 400, damping: 30, mass: 0.6 } : { duration: 0 }}
                          // max-h + an inner scroller: the panel is absolute
                          // inside a FIXED header, so page scroll can never
                          // reach an overflowing bottom — and onScroll closes
                          // the menu anyway. Without this, Log out simply falls
                          // below the fold on a short window.
                          className={`absolute top-full right-0 mt-3 w-80 max-h-[calc(100dvh-7rem)] bg-[#0f0f13] border rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col origin-top-right will-change-transform ${effectCardBorderClass(effectiveEffect)}`}
                        >
                          {/* overflow-hidden lives on the INNER wrapper — on the
                              outer it clips both arrow squares. */}
                          <div className="absolute -top-[6px] right-6 w-3 h-3 bg-[#0f0f13] border-t border-l border-white/10 rotate-45 z-[-1]" />
                          <div className="absolute -top-[5px] right-6 w-3 h-3 bg-[#0f0f13] rotate-45 z-0" />

                          <div className="relative z-10 flex min-h-0 flex-col rounded-2xl overflow-y-auto overscroll-contain custom-scrollbar bg-[#0f0f13] p-1.5">
                            {/* Identity plate */}
                            <div className="relative overflow-hidden rounded-xl border border-white/10 px-3 py-3 mb-1">
                              {effectMeta && (
                                <>
                                  <span aria-hidden className={`absolute inset-0 opacity-[0.18] bg-gradient-to-br ${effectMeta.gradient}`} />
                                  <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent,rgba(15,15,19,0.92))]" />
                                </>
                              )}
                              <div className="relative z-10 flex items-center gap-3">
                                <span className="relative inline-flex shrink-0">
                                  <img src={user.avatar || FALLBACK_AVATAR} alt="" className="relative z-10 w-11 h-11 rounded-full object-cover" />
                                  {animate
                                    ? <AvatarDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />
                                    : <StaticDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />}
                                </span>
                                <span className="flex flex-col min-w-0">
                                  <span className={`text-sm font-bold truncate ${nameClass}`}>{user.username}</span>
                                  <span className="text-[11px] font-semibold text-amber-300/90 tabular-nums">
                                    {displayArisePoints(user)} AP
                                  </span>
                                  {effectMeta && (
                                    <span className="mt-1 flex items-center gap-1.5 min-w-0">
                                      <span className={`truncate text-[11px] font-bold ${effectNameClass(effectiveEffect) || 'text-slate-300'}`}>
                                        {effectMeta.name}
                                      </span>
                                      {TIER_CHIP[effectMeta.tier] && (
                                        <span className={`shrink-0 rounded border px-1 py-px text-[8px] font-black uppercase tracking-wider ${TIER_CHIP[effectMeta.tier]}`}>
                                          {effectMeta.tier === 'exclusive' ? 'Exclusive' : effectMeta.tier}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            <EffectSwitcher slot={slot} user={user} onNavigate={() => setProfileMenuOpen(false)} />

                            <div className="h-px bg-white/[0.07] mx-2 my-1.5" />

                            <Link href={`/user/${user.username}`} data-menu-item role="menuitem" onClick={() => setProfileMenuOpen(false)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60">
                              <UserIcon className="w-4 h-4" /> My Profile
                            </Link>
                            <Link href="/shop" data-menu-item role="menuitem" onClick={() => setProfileMenuOpen(false)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60">
                              <Palette className="w-4 h-4" /> Effects &amp; Frames
                            </Link>
                            <button type="button" data-menu-item role="menuitem"
                              onClick={() => { setProfileMenuOpen(false); setShowControlCenter(true); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60">
                              <Settings className="w-4 h-4" /> Control Center
                            </button>
                            <button type="button" data-menu-item role="menuitem"
                              onClick={() => { setProfileMenuOpen(false); logout(); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400/90 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60">
                              <LogOut className="w-4 h-4" /> Log out
                            </button>

                            {prefsLoaded && preferences.reducedMotion && (
                              <button type="button" data-menu-item role="menuitem"
                                onClick={() => { setProfileMenuOpen(false); setShowControlCenter(true); }}
                                className="w-full text-left px-3 py-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors duration-150">
                                Performance Mode is on — profile effects are paused. <span className="text-purple-400 font-semibold">Change</span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <NotificationsMenu />
                </div>
              ) : (
                <button 
                  onClick={() => setShowLogin(true)}
                  className="hidden lg:block bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-5 xl:px-6 border border-purple-500/50 rounded-full text-sm transition shadow-lg shadow-purple-500/20 whitespace-nowrap"
                >
                  Sign In
                </button>
              )
            )}
            {/* Mobile Menu Toggle */}
            <button 
              className="lg:hidden text-slate-300 hover:text-white p-1 sm:ml-2"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <Link href="/" className="font-cinzel font-bold text-2xl tracking-[0.2em] uppercase text-white flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/logo.png" alt="Da Vinci Logo" className="w-8 h-8 rounded-full border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)] object-cover" />
              DA <span className="text-purple-400 font-black drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">VINCI</span>
            </Link>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* The LINKS scroll; the account block below stays pinned. Previously
              neither had min-h-0, so the links column (overflow:visible, hence an
              immovable auto min-height) refused to shrink and the account block —
              the only flex item that could — absorbed all the negative space and
              collapsed to a hairline, putting Log out out of reach on a phone. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 gap-6 text-xl font-bold text-slate-300">
            {mode === 'anime' ? (
              <>
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Dashboard</Link>
                <Link href="/explore" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Explore</Link>
                <Link href="/airing" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Airing Now</Link>
                <Link href="/upcoming" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Upcoming</Link>
                <Link href="/calendar" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Schedule</Link>
                <Link href="/updates" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Updates</Link>
              </>
            ) : mode === 'manhwa' ? (
              <>
                <Link href="/manhwa" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Dashboard</Link>
                <Link href="/updates" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Updates</Link>
              </>
            ) : (
              <>
                <Link href="/novel" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Library</Link>
                <Link href="/updates" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Updates</Link>
              </>
            )}
            <hr className="border-white/10 my-2" />
            <Link href="/community" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Users className="w-6 h-6" /> Community
            </Link>
            <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <ShoppingBag className="w-6 h-6" /> Shop
            </Link>
            <Link href="/support" onClick={() => setIsMobileMenuOpen(false)} className="text-[#ff5e5b] hover:text-[#ff4542] flex items-center gap-3">
              <Heart className="w-6 h-6" /> Support Us
            </Link>
          </div>
          
          {isLoaded && !user && (
            <div className="mt-auto p-6 border-t border-white/10">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setShowLogin(true); }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl text-lg transition"
              >
                Sign In
              </button>
            </div>
          )}
          {isLoaded && user && (
            <div className="shrink-0 p-6 border-t border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
              {/* Identity + effect switcher — the mobile equivalent of the
                  desktop profile menu. Same component, single-column variant. */}
              <div className="shrink-0 relative overflow-hidden rounded-xl border border-white/10 p-4">
                {effectMeta && (
                  <>
                    <span aria-hidden className={`absolute inset-0 opacity-[0.18] bg-gradient-to-br ${effectMeta.gradient}`} />
                    <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent,rgba(15,15,19,0.92))]" />
                  </>
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <span className="relative inline-flex shrink-0">
                    <img src={user.avatar || FALLBACK_AVATAR} alt="" className="relative z-10 w-14 h-14 rounded-full object-cover" />
                    {animate
                      ? <AvatarDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />
                      : <StaticDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className={`text-base font-bold truncate ${nameClass}`}>{user.username}</span>
                    <span className="text-xs font-semibold text-amber-300/90 tabular-nums">{displayArisePoints(user)} AP</span>
                    <span className={`truncate text-xs font-bold ${effectNameClass(effectiveEffect) || 'text-slate-400'}`}>
                      {effectMeta ? effectMeta.name : 'No effect equipped'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.02] pb-1">
                <EffectSwitcher slot={slot} user={user} variant="sheet" onNavigate={() => setIsMobileMenuOpen(false)} />
              </div>

              <Link href={`/user/${user.username}`} onClick={() => setIsMobileMenuOpen(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl text-lg transition flex justify-center items-center gap-2 border border-white/10 shadow-lg">
                <Compass className="w-5 h-5 text-purple-400" /> My Tracker
              </Link>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setShowControlCenter(true); }}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl text-lg transition flex justify-center items-center gap-2 border border-white/10"
              >
                <Settings className="w-5 h-5" /> Control Center
              </button>
              <button 
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-4 rounded-xl text-lg transition flex justify-center items-center gap-2 border border-red-500/20"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          )}
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
      {popupData && <ArisePointPopup amount={popupData.amount} />}
      <ControlCenter 
        isOpen={showControlCenter} 
        onClose={() => setShowControlCenter(false)} 
      />
    </>
  );
}
