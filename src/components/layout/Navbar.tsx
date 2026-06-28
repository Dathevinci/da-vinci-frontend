"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Compass, Calendar, Activity, User as UserIcon, LogOut, Users, Palette, Menu, X } from 'lucide-react';
import LoginModal from './LoginModal';
import { useUser } from '@/hooks/useUser';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoaded, logout } = useUser();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#09090b]/90 backdrop-blur-md border-b border-white/10 py-3 shadow-2xl' : 'bg-gradient-to-b from-[#09090b]/80 to-transparent py-5'
      }`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-3xl font-black text-white tracking-tighter flex items-center gap-3 drop-shadow-md">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-indigo-400 shadow-lg shadow-indigo-500/20">
                <Palette className="w-6 h-6 text-white" />
              </div>
              Da <span className="text-indigo-500">Vinci</span>
            </Link>
            <nav className="hidden lg:flex gap-6 font-medium text-sm text-slate-300">
              <Link href="/" className="hover:text-white hover:text-indigo-400 transition">Dashboard</Link>
              <Link href="/search?status=RELEASING" className="hover:text-white hover:text-indigo-400 transition">Airing Now</Link>
              <Link href="/search?status=NOT_YET_RELEASED" className="hover:text-white hover:text-indigo-400 transition">Upcoming</Link>
              <Link href="/calendar" className="hover:text-white hover:text-indigo-400 transition">Schedule</Link>
              <Link href="/community" className="hover:text-white hover:text-indigo-400 transition flex items-center gap-2">
                <Users className="w-4 h-4" /> Community
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-6 text-slate-300">
            <Link href="/search" className="hover:text-indigo-400 transition transform hover:scale-110">
              <Search className="w-5 h-5" />
            </Link>
            
            {isLoaded && (
              user ? (
                <div className="flex items-center gap-4">
                  <Link href="/profile" className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 border border-white/10 rounded-full transition shadow-lg text-white">
                    <Compass className="w-4 h-4 text-indigo-400" />
                    My Tracker
                  </Link>
                  <button onClick={logout} className="text-slate-400 hover:text-red-400 transition" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLogin(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-6 border border-indigo-500/50 rounded-full text-sm transition shadow-lg shadow-indigo-500/20"
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
        <div className="fixed inset-0 z-[100] bg-[#09090b] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <Link href="/" className="text-2xl font-black text-white flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
              <Palette className="w-6 h-6 text-indigo-500" />
              Da Vinci
            </Link>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex flex-col p-6 gap-6 text-xl font-bold text-slate-300">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Dashboard</Link>
            <Link href="/search?status=RELEASING" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Airing Now</Link>
            <Link href="/search?status=NOT_YET_RELEASED" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Upcoming</Link>
            <Link href="/calendar" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-indigo-400">Schedule</Link>
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
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
