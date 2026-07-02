"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2, AlertCircle, Info, CheckCheck, Trash2, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

export default function NotificationsMenu() {
  const { notifications, unreadCount, markAllAsRead, clearAll, removeNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-slate-400 hover:text-white transition relative"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center border-2 border-[#18181b]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-full right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-[#0f0f13] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 flex flex-col transform origin-top-right"
          >
            {/* Arrow/Pointer */}
            <div className="absolute -top-[6px] right-2.5 w-3 h-3 bg-[#0f0f13] border-t border-l border-white/10 transform rotate-45 z-[-1]" />
            <div className="absolute -top-[5px] right-2.5 w-3 h-3 bg-[#0f0f13] transform rotate-45 z-0" />

            <div className="flex flex-col flex-1 overflow-hidden rounded-2xl relative z-10 bg-[#0f0f13]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={markAllAsRead} 
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
                >
                  Mark all read
                </button>
                <button 
                  onClick={clearAll} 
                  className="text-xs text-red-400 hover:text-red-300 font-bold transition"
                >
                  Clear
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
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 flex gap-3 group transition-colors relative ${notif.read ? 'bg-transparent' : 'bg-indigo-900/10 hover:bg-indigo-900/20'}`}
                    >
                      {!notif.read && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full"></div>
                      )}
                      
                      <div className="shrink-0 mt-0.5">
                        {notif.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        {notif.type === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
                        {notif.type === "info" && <Info className="w-5 h-5 text-indigo-400" />}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-sm break-words leading-tight ${notif.read ? 'text-slate-300' : 'text-white font-medium'}`}>
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => removeNotification(notif.id)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity p-1 hover:bg-white/10 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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
