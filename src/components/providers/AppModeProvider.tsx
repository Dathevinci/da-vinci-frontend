"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type AppMode = 'anime' | 'manhwa';

// Drives the full-screen curtain overlay (ModeTransition) while switching modes.
export interface ModeTransitionState {
  active: boolean;
  target: AppMode;
}

interface AppModeContextProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  transition: ModeTransitionState;
}

const AppModeContext = createContext<AppModeContextProps | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('anime');
  const [transition, setTransition] = useState<ModeTransitionState>({ active: false, target: 'anime' });
  const timersRef = useRef<number[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  // Load initial mode from local storage
  useEffect(() => {
    const savedMode = localStorage.getItem('daVinciAppMode') as AppMode;
    if (savedMode === 'manhwa' && pathname === '/') {
      // If user preferred manhwa but landed on the root, redirect them
      router.replace('/manhwa');
    } else if (savedMode === 'anime' && pathname === '/manhwa') {
      // If user preferred anime but landed on the manhwa root, redirect them
      router.replace('/');
    } else if (savedMode === 'anime' || savedMode === 'manhwa') {
      // Otherwise just restore the visual state, but only if it matches the current path category
      const isManhwaPath = pathname.startsWith('/manhwa');
      if (isManhwaPath && savedMode === 'manhwa') {
        setModeState('manhwa');
      } else if (!isManhwaPath && savedMode === 'anime') {
        setModeState('anime');
      }
    }
  }, []);

  // Sync mode based on current URL path
  useEffect(() => {
    if (pathname) {
      if (pathname.startsWith('/manhwa')) {
        if (mode !== 'manhwa') {
          setModeState('manhwa');
          localStorage.setItem('daVinciAppMode', 'manhwa');
        }
      } else if (pathname === '/' || pathname.startsWith('/anime') || pathname.startsWith('/explore') || pathname.startsWith('/airing') || pathname.startsWith('/upcoming') || pathname.startsWith('/calendar')) {
        if (mode !== 'anime') {
          setModeState('anime');
          localStorage.setItem('daVinciAppMode', 'anime');
        }
      }
    }
  }, [pathname, mode]);

  // Flip the visual mode + navigate to that mode's home. During a transition
  // this runs while the curtain is fully closed, so the change never flashes.
  const performSwap = (newMode: AppMode) => {
    setModeState(newMode);
    if (newMode === 'manhwa') {
      if (!pathname.startsWith('/manhwa')) router.push('/manhwa');
    } else {
      if (pathname.startsWith('/manhwa')) router.push('/');
    }
  };

  const setMode = (newMode: AppMode) => {
    localStorage.setItem('daVinciAppMode', newMode);

    // Same mode — just make sure we're on the right page, no curtain needed.
    if (newMode === mode) {
      performSwap(newMode);
      return;
    }

    // Real switch → play the cinematic curtain, swapping behind it while closed.
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    setTransition({ active: true, target: newMode });
    timersRef.current.push(
      window.setTimeout(() => performSwap(newMode), 500),                               // swap while covered
      window.setTimeout(() => setTransition((prev) => ({ ...prev, active: false })), 1000), // part the curtain
    );
  };

  const toggleMode = () => {
    setMode(mode === 'anime' ? 'manhwa' : 'anime');
  };

  // Clear any pending transition timers on unmount.
  useEffect(() => () => { timersRef.current.forEach((t) => clearTimeout(t)); }, []);

  // Add a class to body for global CSS theming
  useEffect(() => {
    if (mode === 'manhwa') {
      document.body.classList.add('theme-manhwa');
      document.body.classList.remove('theme-anime');
    } else {
      document.body.classList.add('theme-anime');
      document.body.classList.remove('theme-manhwa');
    }
  }, [mode]);

  return (
    <AppModeContext.Provider value={{ mode, setMode, toggleMode, transition }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
