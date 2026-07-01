"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, User as UserIcon } from "lucide-react";
import { useUser } from "@/hooks/useUser";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useUser();

  const navItems = [
    { label: "Home", href: "/", icon: <Home className="w-6 h-6" /> },
    { label: "Explore", href: "/explore", icon: <Compass className="w-6 h-6" /> },
    { label: "Community", href: "/community", icon: <Users className="w-6 h-6" /> },
    { label: "Profile", href: user ? "/profile" : "/user/login", icon: <UserIcon className="w-6 h-6" />, action: !user ? "login" : undefined }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/90 backdrop-blur-xl border-t border-white/10 pb-safe md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          if (item.authRequired && !user) return null;

          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <div className={`relative ${isActive ? "scale-110 transition-transform" : ""}`}>
                {item.icon}
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                )}
              </div>
              <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
