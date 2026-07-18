"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type AppMode = 'anime' | 'manhwa';

interface AppModeContextProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const AppModeContext = createContext<AppModeContextProps | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('anime');
  const pathname = usePathname();
  const router = useRouter();

  // Load initial mode from local storage
  useEffect(() => {
    const savedMode = localStorage.getItem('daVinciAppMode') as AppMode;
    if (savedMode === 'anime' || savedMode === 'manhwa') {
      setModeState(savedMode);
    }
  }, []);

  // Sync mode based on current URL path
  useEffect(() => {
    if (pathname) {
      if (pathname.startsWith('/manhwa')) {
        if (mode !== 'manhwa') setModeState('manhwa');
      } else if (pathname === '/' || pathname.startsWith('/anime') || pathname.startsWith('/explore') || pathname.startsWith('/airing') || pathname.startsWith('/upcoming') || pathname.startsWith('/calendar')) {
        if (mode !== 'anime') setModeState('anime');
      }
    }
  }, [pathname]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('daVinciAppMode', newMode);
    
    // Redirect to the appropriate home page for the selected mode
    if (newMode === 'manhwa') {
      if (!pathname.startsWith('/manhwa')) router.push('/manhwa');
    } else {
      if (pathname.startsWith('/manhwa')) router.push('/');
    }
  };

  const toggleMode = () => {
    setMode(mode === 'anime' ? 'manhwa' : 'anime');
  };

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
    <AppModeContext.Provider value={{ mode, setMode, toggleMode }}>
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
