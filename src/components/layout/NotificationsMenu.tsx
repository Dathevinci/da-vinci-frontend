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

/**
 * `openUp` flips the panel above the bell instead of below it.
 *
 * The bar this lives in moved to the bottom of the screen on desktop, and a
 * panel anchored to top-full then opens straight off the bottom edge — you
 * click the bell and the notifications go where you can't reach them.
 */
export default function NotificationsMenu({ openUp = false, onOpenChange }: { openUp?: boolean; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { notifications, unreadCount, markAllAsRead, clearAll, removeNotification, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const shown = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  // Group by day so a long list reads as a timeline instead of one flat wall.
  const groups: { label: string; items: typeof notifications }[] = [];
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - 86_400_000;
  for (const n of shown) {
    const label = n.timestamp >= startOfToday ? "Today" : n.timestamp >= startOfYesterday ? "Yesterday" : "Earlier";
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(n);
    else groups.push({ label, items: [n] });
  }

  // Close on outside tap (pointerdown covers both mouse and touch), and also
  // when the user scrolls the page — an absolutely-positioned panel would
  // otherwise drift away from the bell as the header moves.
  //
  // The scroll-close is ANCHORED PRESENTATIONS ONLY (sm+, where the panel is
  // absolute to the bell). Below sm the panel is viewport-fixed, so page
  // scroll can't move it — and on touch, any swipe on a non-scrolling part
  // of the panel chains to the body, fires window scroll, and was dismissing
  // the panel mid-gesture.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => setIsOpen(false);
    const anchored = window.matchMedia("(min-width: 640px)").matches;
    document.addEventListener("pointerdown", handlePointerDown);
    if (anchored) window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      if (anchored) window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  // The bar this sits in auto-hides on pointer-out. Without telling it the
  // panel is open, moving the mouse away would take the notifications with it.
  useEffect(() => { onOpenChange?.(isOpen); }, [isOpen]);

  // Close whenever the route changes (e.g. tapping a notification link).
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger — a bare icon gave no hit area and no open-state feedback. */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className={`relative grid h-9 w-9 place-items-center rounded-full transition-colors ${
          isOpen ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <motion.span
          // a single nudge when something new lands, not a looping distraction
          key={unreadCount}
          animate={unreadCount > 0 ? { rotate: [0, -12, 10, -6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="flex"
        >
          <Bell className="h-5 w-5" />
        </motion.span>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-black text-white ring-2 ring-[#030305]">
            {unreadCount > 9 ? "9+" : unreadCount}
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-purple-500/60" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            // Slides FROM the bell in whichever direction it opens.
            initial={{ opacity: 0, scale: 0.96, y: openUp ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: openUp ? 8 : -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.6 }}
            className={`fixed right-4 left-4 ${openUp ? "top-auto bottom-24" : "top-16"} sm:absolute sm:-right-4 sm:left-auto sm:w-96 max-w-sm max-h-[calc(100dvh-7.5rem)] bg-[#0f0f13] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] flex flex-col will-change-transform ${openUp ? "sm:top-auto sm:bottom-full sm:mb-3 origin-bottom-right" : "sm:top-full sm:mt-3 origin-top-right"}`}
          >
            {/* Arrow/Pointer — desktop only. On phones the panel is a
                full-width float nowhere near the bell, so a pointer would
                aim at empty air. */}
            <div className={`hidden sm:block absolute right-14 sm:right-10 w-3 h-3 bg-[#0f0f13] border-white/10 transform rotate-45 z-[-1] ${openUp ? "-bottom-[6px] border-b border-r" : "-top-[6px] border-t border-l"}`} />
            <div className={`hidden sm:block absolute right-14 sm:right-10 w-3 h-3 bg-[#0f0f13] transform rotate-45 z-0 ${openUp ? "-bottom-[5px]" : "-top-[5px]"}`} />

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

            {/* All / Unread — the old panel made you eyeball the list for
                the ones you hadn't seen yet. */}
            <div className="flex gap-1 border-b border-white/10 px-3 py-2">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize transition ${
                    filter === f ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {f}
                  {f === "unread" && unreadCount > 0 && <span className="ml-1 text-purple-400">{unreadCount}</span>}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto overscroll-contain max-h-[400px] custom-scrollbar">
              {shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">
                    {filter === "unread" ? "Nothing unread" : "You're all caught up!"}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {filter === "unread" ? "Every notification has been read." : "No new notifications."}
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-[#0f0f13]/95 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                    {group.label}
                  </div>
                <div className="divide-y divide-white/5">
                  {group.items.map((notif) => {
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
                </div>
                ))
              )}
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
