"use client";

import { Bell, Check, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useNotifications, Notification } from '@/hooks/useNotifications';

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h3 className="font-bold text-white">Notifications</h3>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>
      
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notif: Notification) => (
              <div 
                key={notif.id} 
                className={`p-4 transition hover:bg-white/5 ${notif.isRead ? 'opacity-70' : 'bg-indigo-500/5'}`}
                onClick={() => {
                  if (!notif.isRead) markAsRead(notif.id);
                }}
              >
                <div className="flex gap-3 items-start">
                  {notif.actor.avatar ? (
                    <img src={notif.actor.avatar} alt={notif.actor.username} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border border-white/10 text-white font-bold">
                      {notif.actor.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">{notif.actor.username}</span>
                      {notif.type === 'NEW_FOLLOWER' ? ' started following you!' : notif.message}
                    </p>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                    {notif.link && (
                      <Link href={notif.link} className="text-xs text-indigo-400 hover:underline mt-1 inline-block">
                        View Profile
                      </Link>
                    )}
                  </div>
                  
                  {!notif.isRead && (
                    <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
