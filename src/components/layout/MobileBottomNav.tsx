"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, User as UserIcon, Megaphone, BookOpen } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { usePreferences } from "@/hooks/usePreferences";
import { useAppMode } from "@/components/providers/AppModeProvider";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { StaticDecoration } from "@/components/profile/StaticDecoration";
import { resolveActiveEffect } from "@/components/profile/CrimsonRealm";

const FALLBACK_AVATAR = "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { preferences, isLoaded: prefsLoaded } = usePreferences();
  const { mode } = useAppMode();

  // This file had zero Performance-Mode awareness before; the decoration below
  // animates, so consulting preferences is mandatory rather than optional.
  const animate = prefsLoaded && !preferences.reducedMotion;
  const effectiveEffect = user ? resolveActiveEffect(user, (user as any).activeEffect) : undefined;

  // The wrapper MUST be `relative` and the <img> MUST be `relative z-10`, or the
  // decoration either paints over the avatar or escapes the tile.
  const profileIcon = user ? (
    <span className="relative inline-flex">
      <img src={user.avatar || FALLBACK_AVATAR} alt="" className="relative z-10 w-6 h-6 rounded-full object-cover" />
      {animate
        ? <AvatarDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />
        : <StaticDecoration frame={(user as any).activeFrame} effect={effectiveEffect} />}
    </span>
  ) : (
    <UserIcon className="w-6 h-6" />
  );

  const accentColor = mode === 'anime' ? 'text-purple-400' : mode === 'manhwa' ? 'text-red-500' : 'text-pink-400';
  const bgBadge = mode === 'anime' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : mode === 'manhwa' ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]' : 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]';

  const navItemsAnime = [
    { label: "Home", href: "/", icon: <Home className="w-6 h-6" /> },
    { label: "Explore", href: "/explore", icon: <Compass className="w-6 h-6" /> },
    { label: "Updates", href: "/updates", icon: <Megaphone className="w-6 h-6" /> },
    { label: "Community", href: "/community", icon: <Users className="w-6 h-6" /> },
    { label: "Profile", href: user ? `/user/${user.username}` : "/user/login", icon: profileIcon }
  ];

  const navItemsManhwa = [
    { label: "Home", href: "/manhwa", icon: <Home className="w-6 h-6" /> },
    { label: "Updates", href: "/updates", icon: <Megaphone className="w-6 h-6" /> },
    { label: "Community", href: "/community", icon: <Users className="w-6 h-6" /> },
    { label: "Profile", href: user ? `/user/${user.username}` : "/user/login", icon: profileIcon }
  ];

  const navItemsNovel = [
    { label: "Library", href: "/novel", icon: <BookOpen className="w-6 h-6" /> },
    { label: "Updates", href: "/updates", icon: <Megaphone className="w-6 h-6" /> },
    { label: "Community", href: "/community", icon: <Users className="w-6 h-6" /> },
    { label: "Profile", href: user ? `/user/${user.username}` : "/user/login", icon: profileIcon }
  ];

  const navItems = mode === 'anime' ? navItemsAnime : mode === 'manhwa' ? navItemsManhwa : navItemsNovel;

  // Hide on immersive chapter readers so it doesn't cover their controls.
  if (pathname && pathname.includes('/chapter/')) return null;

  return (
    <nav id="mobile-bottom-nav" className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/10 pb-safe md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item: any) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? accentColor : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <div className={`relative ${isActive ? "scale-110 transition-transform" : ""}`}>
                {item.icon}
                {isActive && (
                  <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${bgBadge}`} />
                )}
              </div>
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
