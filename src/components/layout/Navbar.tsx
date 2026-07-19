"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Compass, Calendar, Activity, User as UserIcon, LogOut, Users, Palette, ShoppingBag, Menu, X, Settings, Heart, ChevronDown } from 'lucide-react';
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

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const { mode, toggleMode } = useAppMode();
  
  // Theming variables based on mode
  const accentText = mode === 'anime' ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]';
  const accentHover = mode === 'anime' ? 'hover:text-purple-400' : 'hover:text-emerald-400';
  const accentBorder = mode === 'anime' ? 'border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.4)]';

  // Desktop Links
  const animeLinks = (
    <>
      <Link href="/" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Dashboard</Link>
      <Link href="/explore" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Explore</Link>
      <div className="relative group">
        <button className={`hover:text-white ${accentHover} transition flex items-center gap-1`}>
          Discover <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
        </button>
        <div className="absolute top-full left-0 mt-6 w-48 bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden py-2 before:absolute before:-top-6 before:left-0 before:w-full before:h-6 before:bg-transparent">
          <Link href="/airing" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Activity className="w-4 h-4" /> Airing Now</Link>
          <Link href="/upcoming" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Compass className="w-4 h-4" /> Upcoming</Link>
          <Link href="/calendar" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Calendar className="w-4 h-4" /> Schedule</Link>
        </div>
      </div>
    </>
  );

  const manhwaLinks = (
    <>
      <Link href="/manhwa" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Dashboard</Link>
      <Link href="/updates" className={`hover:text-white ${accentHover} transition whitespace-nowrap`}>Updates</Link>
    </>
  );

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? `bg-[#030305]/90 backdrop-blur-lg border-b ${isDejavuh ? 'border-purple-500/30 shadow-[0_4px_30px_rgba(168,85,247,0.15)]' : 'border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}`
          : 'bg-gradient-to-b from-[#030305]/80 to-transparent'
      }`}>
        <div className={`container mx-auto px-4 sm:px-6 flex justify-between items-center transition-all duration-300 ${isScrolled ? 'h-16' : 'h-20 lg:h-24'}`}>
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href={mode === 'anime' ? "/" : "/manhwa"} className="font-fell font-bold text-xl sm:text-2xl lg:text-3xl text-white tracking-[0.1em] sm:tracking-[0.2em] uppercase flex items-center gap-2 sm:gap-3 drop-shadow-lg shrink-0">
              <img src="/logo.png" alt="Da Vinci Logo" className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border ${accentBorder} object-cover transition-colors`} />
              <span className="hidden xs:inline-block">DA <span className={`font-black ${accentText} transition-colors`}>VINCI</span></span>
            </Link>
            
            {/* Mode Switcher */}
            <button 
              onClick={toggleMode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shrink-0"
              title="Switch Mode"
            >
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${mode === 'anime' ? 'text-purple-400' : 'text-emerald-400'}`}>
                {mode === 'anime' ? 'Anime Mode' : 'Manhwa Mode'}
              </span>
            </button>

            <nav className="hidden lg:flex gap-4 xl:gap-6 font-medium text-sm text-slate-300 shrink-0">
              {mode === 'anime' ? animeLinks : manhwaLinks}
              
              <div className="relative group">
                <button className={`hover:text-white ${accentHover} transition flex items-center gap-1`}>
                  More <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                </button>
                <div className="absolute top-full left-0 mt-6 w-48 bg-[#0f0f11] border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden py-2 before:absolute before:-top-6 before:left-0 before:w-full before:h-6 before:bg-transparent">
                  <Link href="/community" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><Users className="w-4 h-4" /> Community</Link>
                  <Link href="/shop" className={`px-4 py-2 hover:bg-white/5 ${accentHover} transition flex items-center gap-2`}><ShoppingBag className="w-4 h-4" /> Shop</Link>
                  <Link href="/support" className="px-4 py-2 hover:bg-white/5 text-[#ff5e5b] hover:text-[#ff4542] transition flex items-center gap-2"><Heart className="w-4 h-4" /> Support Us</Link>
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
          
          <div className="flex flex-col p-6 gap-6 text-xl font-bold text-slate-300">
            {mode === 'anime' ? (
              <>
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Dashboard</Link>
                <Link href="/explore" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Explore</Link>
                <Link href="/airing" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Airing Now</Link>
                <Link href="/upcoming" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Upcoming</Link>
                <Link href="/calendar" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Schedule</Link>
              </>
            ) : (
              <>
                <Link href="/manhwa" onClick={() => setIsMobileMenuOpen(false)} className={accentHover}>Dashboard</Link>
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
                className="w-full bg-indigo- hover:bg-purple-500 text-white font-bold py-4 rounded-xl text-lg transition"
              >
                Sign In
              </button>
            </div>
          )}
          {isLoaded && user && (
            <div className="mt-auto p-6 border-t border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[50vh]">
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
