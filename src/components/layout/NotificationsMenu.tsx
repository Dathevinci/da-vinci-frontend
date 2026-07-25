"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2, AlertCircle, Info, CheckCheck, Trash2, X, UserPlus, Heart, MessageSquare, AtSign, Sparkles, Gift, Diamond, Wand2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useRouter, usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Every notification type the server actually emits, mapped to its own icon and
 * accent. Previously the panel only handled "success" | "error" | "info", so a
 * blessing, a gift, a new follower and an Arise Points payout all rendered the
 * same generic dot — or none at all.
 */
const NOTIF_STYLE: Record<string, { Icon: any; tint: string; ring: string }> = {
  NEW_FOLLOWER: { Icon: UserPlus, tint: "text-sky-300", ring: "bg-sky-500/15 border-sky-500/25" },
  like: { Icon: Heart, tint: "text-rose-300", ring: "bg-rose-500/15 border-rose-500/25" },
  reply: { Icon: MessageSquare, tint: "text-purple-300", ring: "bg-purple-500/15 border-purple-500/25" },
  mention: { Icon: AtSign, tint: "text-purple-300", ring: "bg-purple-500/15 border-purple-500/25" },
  blessing: { Icon: Sparkles, tint: "text-amber-300", ring: "bg-amber-400/15 border-amber-400/30" },
  tip: { Icon: Sparkles, tint: "text-amber-300", ring: "bg-amber-400/15 border-amber-400/30" },
  gift: { Icon: Gift, tint: "text-fuchsia-300", ring: "bg-fuchsia-500/15 border-fuchsia-500/25" },
  effect: { Icon: Wand2, tint: "text-fuchsia-300", ring: "bg-fuchsia-500/15 border-fuchsia-500/25" },
  frame: { Icon: Wand2, tint: "text-fuchsia-300", ring: "bg-fuchsia-500/15 border-fuchsia-500/25" },
  success: { Icon: CheckCircle2, tint: "text-emerald-300", ring: "bg-emerald-500/15 border-emerald-500/25" },
  error: { Icon: AlertCircle, tint: "text-red-300", ring: "bg-red-500/15 border-red-500/25" },
};

function styleFor(notif: { rawType?: string; type?: string }) {
  const raw = notif.rawType || "";
  if (NOTIF_STYLE[raw]) return NOTIF_STYLE[raw];
  // every ARISE_POINTS_* variant is a currency payout
  if (raw.startsWith("ARISE_POINTS")) {
    return { Icon: Diamond, tint: "text-emerald-300", ring: "bg-emerald-500/15 border-emerald-500/25" };
  }
  return NOTIF_STYLE[notif.type || "info"] || { Icon: Info, tint: "text-slate-300", ring: "bg-white/10 border-white/15" };
}

export default function NotificationsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, unreadCount, markAllAsRead, clearAll, removeNotification, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside tap (pointerdown covers both mouse and touch), and also
  // when the user scrolls the page — an absolutely-positioned panel would
  // otherwise drift away from the bell as the header moves.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  // Close whenever the route changes (e.g. tapping a notification link).
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-slate-400 hover:text-white transition relative"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center border-2 border-[#18181b]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.6 }}
            className="fixed top-16 right-4 left-4 sm:absolute sm:top-full sm:-right-4 sm:left-auto sm:mt-3 sm:w-96 max-w-sm bg-[#0f0f13] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col origin-top-right will-change-transform"
          >
            {/* Arrow/Pointer */}
            <div className="absolute -top-[6px] right-14 sm:right-10 w-3 h-3 bg-[#0f0f13] border-t border-l border-white/10 transform rotate-45 z-[-1]" />
            <div className="absolute -top-[5px] right-14 sm:right-10 w-3 h-3 bg-[#0f0f13] transform rotate-45 z-0" />

            <div className="flex flex-col flex-1 overflow-hidden rounded-2xl relative z-10 bg-[#0f0f13]">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-black text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              {/* icon-only actions with tooltips — two competing red/purple text
                  links read as the loudest thing in the panel */}
              <div className="flex items-center gap-1">
                <button
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  title="Mark all as read"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  onClick={clearAll}
                  disabled={notifications.length === 0}
                  title="Clear all"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">You're all caught up!</p>
                  <p className="text-slate-500 text-xs mt-1">No new notifications.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((notif) => {
                    const { Icon, tint, ring } = styleFor(notif as any);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.read) markAsRead(notif.id);
                          if (notif.link) {
                            setIsOpen(false);
                            router.push(notif.link);
                          }
                        }}
                        className={`group relative flex gap-3 px-4 py-3 transition-colors ${
                          notif.read ? "hover:bg-white/[0.04]" : "bg-purple-500/[0.07] hover:bg-purple-500/[0.12]"
                        } ${notif.link ? "cursor-pointer" : ""}`}
                      >
                        {!notif.read && (
                          <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-purple-500" />
                        )}

                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ring}`}>
                          <Icon className={`h-4 w-4 ${tint}`} />
                        </div>

                        <div className="min-w-0 flex-1 pr-5">
                          <p className={`break-words text-sm leading-snug ${notif.read ? "text-slate-400" : "font-medium text-white"}`}>
                            {notif.message}
                          </p>
                          <span className="mt-1 block text-[10px] tabular-nums text-slate-500">
                            {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notif.id);
                          }}
                          aria-label="Dismiss"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
