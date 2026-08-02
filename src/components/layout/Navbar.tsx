"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Search, Compass, Calendar, Activity, User as UserIcon, LogOut, Users, Palette, ShoppingBag, Menu, X, Settings, Heart, ChevronDown, Tv, BookMarked, BookOpen, Swords, Terminal, Layers, Gavel, Trophy, Castle, Gamepad2 } from 'lucide-react';
import { isAdmin, isLeadDev } from "@/lib/admin";
import LoginModal from './LoginModal';
import SearchModal from './SearchModal';
import ArisePointPopup from '../ui/ArisePointPopup';
import ControlCenter from './ControlCenter';
import NotificationsMenu from './NotificationsMenu';
import { useUser } from '@/hooks/useUser';
import { useAppMode } from '@/components/providers/AppModeProvider';
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import UserLink from "@/components/profile/UserLink";
import NavIsland from "./NavIsland";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  // `peek` is hover-reveal: the bar is out of the way, but reaching for the top
  // of the screen brings it straight back without needing to scroll up first.
  const [peek, setPeek] = useState(false);
  /**
   * The island is DESKTOP ONLY. It is built on hover, and a touch screen has
   * no hover — auto-hiding there would take the nav away with no gesture to
   * bring it back except scrolling up, which is strictly worse than the bar
   * simply staying put. Mobile keeps the behaviour it always had.
   *
   * Starts false so the server render and the first client render agree; the
   * effect below is what turns it on, after mount.
   */
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  
  const { user, isLoaded, logout } = useUser();

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
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setIsScrolled((prev) => {
          const next = y > 20;
          return prev === next ? prev : next;
        });
        /**
         * Hide on the way DOWN, come back on the way UP. Reading is the thing
         * this site is for, and a fixed bar costs 64-96px of every screen.
         * Direction-based rather than position-based so the bar is always one
         * small upward scroll away instead of a trip to the top of the page.
         *
         * The 6px deadzone stops trackpad jitter flickering it, and it never
         * hides in the first 90px so it is present when a page opens. The bar
         * animates with translateY only — a transform, so it composites on the
         * GPU and never reflows the page beneath it.
         */
        setHidden((prev) => {
          if (Math.abs(y - lastY) < 6) return prev;
          const next = y > lastY && y > 90;
          lastY = y;
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

  // Immersive readers (manhwa/novel chapter pages) render their own top bar —
  // hide the global navbar so it doesn't overlap them.
  if (pathname && pathname.includes('/chapter/')) return null;

  return (
    <>
      {/* ── DESKTOP ── the island replaces the bar entirely above lg. */}
      <NavIsland onSearch={() => setShowSearchModal(true)} onSettings={() => setShowControlCenter(true)} />

      {/* ── MOBILE ── the original bar, untouched, and no longer auto-hiding:
          the island is small enough to leave up, so hiding exists for nobody.
          `lg:hidden` is what keeps the two from ever stacking. */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 lg:hidden ${
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
                    <Link href="/quests" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Swords className="w-4 h-4" /> Daily Quests</Link>
                    {/* isLeadDev, NOT isAdmin — isAdmin() returns true for every
                        admin as well as the lead dev, so it would advertise a
                        console where each button 403s. This link is convenience
                        only; the API is the real gate. */}
                    {isDejavuh && (
                      <Link href="/console" className="px-4 py-2 hover:bg-white/5 text-fuchsia-400 hover:text-fuchsia-300 transition flex items-center gap-2"><Terminal className="w-4 h-4" /> Console</Link>
                    )}
                    <Link href="/shop" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><ShoppingBag className="w-4 h-4" /> Shop</Link>

                    {/* Games — cards and duels are their own thing, not shop
                        inventory. They were crowding the shop header. */}
                    <div className="my-1.5 border-t border-white/10" />
                    <span className="px-4 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Games</span>
                    <Link href="/cards" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Layers className="w-4 h-4" /> Arise Cards</Link>
                    <Link href="/duels" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Swords className="w-4 h-4" /> Card Duels</Link>
                    <Link href="/dungeon" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Castle className="w-4 h-4" /> Dungeon Dispatch</Link>
                    <Link href="/leaderboard" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Trophy className="w-4 h-4" /> Leaderboard</Link>
                    <Link href="/auctions" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Gavel className="w-4 h-4" /> Auction House</Link>
                    <div className="my-1.5 border-t border-white/10" />

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
                <div className="hidden lg:flex items-center gap-3 xl:gap-4 relative shrink-0">
                  <UserLink username={user.username} className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-3 py-2 xl:px-4 xl:py-2 border border-white/10 rounded-full transition shadow-lg text-white whitespace-nowrap group">
                    <span className="relative inline-flex shrink-0">
                      <img src={user.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80'} className="relative z-10 w-6 h-6 rounded-full object-cover" />
                      <AvatarDecoration frame={(user as any).activeFrame} />
                    </span>
                    <span className={`hidden xl:inline transition
                      ${user.activeFont === 'font_cyber' ? 'font-mono tracking-widest' : ''} 
                      ${user.activeFont === 'font_pixel' ? 'font-serif tracking-tight' : ''} 
                      ${user.activeColor === 'color_gold' ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' :
                        user.activeColor === 'color_neon_pink' ? 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]' :
                        isAdmin(user) ? 'text-purple-300 group-hover:text-purple-400' : 
                        'text-slate-200 group-hover:text-purple-400'}`}>
                      {user.username}
                    </span>
                  </UserLink>
                  <NotificationsMenu />
                  <button onClick={() => setShowControlCenter(true)} className="text-slate-400 hover:text-white transition p-1" title="Control Center">
                    <Settings className="w-5 h-5" />
                  </button>
                  <button onClick={logout} className="text-slate-400 hover:text-red-400 transition p-1" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
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
            {/* Mobile Menu Toggle — TABLETS ONLY.
                Below md the bottom bar's More sheet carries these same links,
                so on a phone this was a second menu with identical contents
                sitting in the top corner. Between md and lg there is no bottom
                bar, so it still has to exist there. */}
            <button
              className="hidden md:block lg:hidden text-slate-300 hover:text-white p-1 sm:ml-2"
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
          
          <div className="flex flex-col p-6 gap-6 text-xl font-bold text-slate-300">
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
            {isDejavuh && (
              <Link href="/console" onClick={() => setIsMobileMenuOpen(false)} className="text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-3">
                <Terminal className="w-6 h-6" /> Console
              </Link>
            )}
            <Link href="/quests" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Swords className="w-6 h-6" /> Daily Quests
            </Link>
            <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <ShoppingBag className="w-6 h-6" /> Shop
            </Link>

            {/* Games — their own group, not shop inventory */}
            <hr className="border-white/10 my-2" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Games</span>
            <Link href="/cards" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Layers className="w-6 h-6" /> Arise Cards
            </Link>
            <Link href="/duels" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Swords className="w-6 h-6" /> Card Duels
            </Link>
            <Link href="/dungeon" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Castle className="w-6 h-6" /> Dungeon Dispatch
            </Link>
            <Link href="/leaderboard" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Trophy className="w-6 h-6" /> Leaderboard
            </Link>
            <Link href="/auctions" onClick={() => setIsMobileMenuOpen(false)} className={`${accentHover} flex items-center gap-3`}>
              <Gavel className="w-6 h-6" /> Auction House
            </Link>
            <hr className="border-white/10 my-2" />

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
            <div className="mt-auto p-6 border-t border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[50dvh]">
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
