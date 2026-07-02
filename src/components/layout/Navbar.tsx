"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Compass, Calendar, Activity, User as UserIcon, LogOut, Users, Palette, Menu, X, Settings } from 'lucide-react';
import LoginModal from './LoginModal';
import SearchModal from './SearchModal';
import ArisePointPopup from '../ui/ArisePointPopup';
import SettingsModal from '../profile/SettingsModal';
import ControlCenter from './ControlCenter';
import NotificationsMenu from './NotificationsMenu';
import { useUser } from '@/hooks/useUser';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  
  const { user, isLoaded, logout } = useUser();

  const [prevPoints, setPrevPoints] = useState<number | null>(null);
  const [popupData, setPopupData] = useState<{ amount: number } | null>(null);

  const isDejavuh = user?.username?.toLowerCase() === 'dejavuh';

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
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
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

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? `bg-white/5 backdrop-blur-2xl border-b ${isDejavuh ? 'border-purple-500/30 shadow-[0_4px_30px_rgba(168,85,247,0.15)]' : 'border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}` 
          : 'bg-gradient-to-b from-black/80 to-transparent py-5'
      }`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-cinzel font-bold text-2xl lg:text-3xl text-white tracking-[0.2em] uppercase flex items-center gap-3 drop-shadow-lg">
              <img src="/logo.png" alt="Da Vinci Logo" className="w-10 h-10 rounded-full border border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)] object-cover" />
              DA <span className="text-indigo-400 font-black drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">VINCI</span>
            </Link>
            <nav className="hidden lg:flex gap-6 font-medium text-sm text-slate-300">
              <Link href="/" className="hover:text-white hover:text-indigo-400 transition">Dashboard</Link>
              <Link href="/airing" className="hover:text-white hover:text-indigo-400 transition">Airing Now</Link>
              <Link href="/upcoming" className="hover:text-white hover:text-indigo-400 transition">Upcoming</Link>
              <Link href="/calendar" className="hover:text-white hover:text-indigo-400 transition">Schedule</Link>
              <Link href="/updates" className="hover:text-white hover:text-indigo-400 transition">Updates</Link>
              <Link href="/community" className="hover:text-white hover:text-indigo-400 transition flex items-center gap-2">
                <Users className="w-4 h-4" /> Community
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-6 text-slate-300">
            <button onClick={() => setShowSearchModal(true)} className="hover:text-indigo-400 transition transform hover:scale-110 flex items-center gap-2">
              <Search className="w-5 h-5" />
              <span className="hidden lg:flex items-center gap-1 text-xs font-medium bg-white/10 px-2 py-0.5 rounded text-slate-400 border border-white/5 shadow-inner">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
              </span>
            </button>
            
            <div className="lg:hidden flex items-center">
              <NotificationsMenu />
            </div>
            
            {isLoaded && (
              user ? (
                <div className="hidden lg:flex items-center gap-4 relative">
                  <Link href="/profile" className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 border border-white/10 rounded-full transition shadow-lg text-white whitespace-nowrap">
                    <Compass className="w-4 h-4 text-indigo-400" />
                    My Tracker
                  </Link>
                  <NotificationsMenu />
                  <button onClick={() => setShowControlCenter(true)} className="text-slate-400 hover:text-white transition" title="Control Center">
                    <Settings className="w-5 h-5" />
                  </button>
                  <button onClick={logout} className="text-slate-400 hover:text-red-400 transition" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLogin(true)}
                  className="hidden lg:block bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-6 border border-indigo-500/50 rounded-full text-sm transition shadow-lg shadow-indigo-500/20"
                >
                  Sign In
                </button>
              )
            )}
            {/* Mobile Menu Toggle */}
            <button 
              className="lg:hidden text-slate-300 hover:text-white ml-2"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-3xl flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <Link href="/" className="font-cinzel font-bold text-2xl tracking-[0.2em] uppercase text-white flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/logo.png" alt="Da Vinci Logo" className="w-8 h-8 rounded-full border border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)] object-cover" />
              DA <span className="text-indigo-400 font-black drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">VINCI</span>
            </Link>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex flex-col p-6 gap-6 text-xl font-bold text-slate-300">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Dashboard</Link>
            <Link href="/airing" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Airing Now</Link>
            <Link href="/upcoming" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Upcoming</Link>
            <Link href="/calendar" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Schedule</Link>
            <Link href="/updates" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Updates</Link>
            <Link href="/community" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400 flex items-center gap-3">
              <Users className="w-6 h-6" /> Community
            </Link>
          </div>
          
          {isLoaded && !user && (
            <div className="mt-auto p-6 border-t border-white/10">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); setShowLogin(true); }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl text-lg transition"
              >
                Sign In
              </button>
            </div>
          )}
          {isLoaded && user && (
            <div className="mt-auto p-6 border-t border-white/10 flex flex-col gap-4 overflow-y-auto max-h-[50vh]">
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl text-lg transition flex justify-center items-center gap-2 border border-white/10 shadow-lg">
                <Compass className="w-5 h-5 text-indigo-400" /> My Tracker
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
