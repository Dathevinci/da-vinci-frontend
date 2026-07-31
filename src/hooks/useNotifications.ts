"use client";

import { useState, useEffect, useCallback } from "react";
import { ToastType } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";

export interface NotificationItem {
  id: string;
  message: string;
  type: ToastType;
  /**
   * The server's ORIGINAL notification type ("blessing", "gift", "tip",
   * "mention", "NEW_FOLLOWER", "reply", "ARISE_POINTS_*", …). `type` above is
   * only a coarse success/info bucket for toast styling — collapsing to it
   * threw away everything the panel needs to show a meaningful icon, so all
   * thirteen server types rendered as the same generic dot.
   */
  rawType?: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications/${user.id}`);
      const data = await res.json();
      if (data.success) {
        const mapped: NotificationItem[] = data.data.map((n: any) => ({
          id: n.id,
          message: n.message,
          type: n.type === "like" || n.type === "success" ? "success" : "info",
          rawType: n.type,
          timestamp: new Date(n.createdAt).getTime(),
          read: n.isRead,
          link: n.link,
        }));
        setNotifications(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  }, [user, API_URL]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setIsLoaded(true);

      /**
       * Poll only while the tab is actually being looked at.
       *
       * This used to fire every 30s unconditionally — 120 requests an hour from
       * every open tab, including ones sitting in the background for days. Each
       * one hits the database, and Neon only suspends compute once there are NO
       * connections for a while, so the database never got an idle window and
       * burned its entire monthly compute allowance staying awake for tabs
       * nobody was reading.
       *
       * Backgrounded tabs now poll nothing at all, and the interval is 2 minutes
       * rather than 30 seconds. A fetch fires immediately on returning to the
       * tab, so notifications still feel current where it matters.
       */
      const POLL_MS = 120_000;
      let interval: ReturnType<typeof setInterval> | null = null;

      const stop = () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };
      const start = () => {
        stop();
        interval = setInterval(fetchNotifications, POLL_MS);
      };

      const onVisibility = () => {
        if (document.hidden) {
          stop();
        } else {
          fetchNotifications(); // catch up on whatever arrived while away
          start();
        }
      };

      if (!document.hidden) start();
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        stop();
        document.removeEventListener("visibilitychange", onVisibility);
      };
    } else {
      // Load local if no user
      const stored = localStorage.getItem("davinci_notifications");
      if (stored) {
        try {
          setNotifications(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse notifications", e);
        }
      }
      setIsLoaded(true);
    }
  }, [user, fetchNotifications]);

  const addNotification = (message: string, type: ToastType = "info") => {
    if (user) {
      // Backend handles real notifications, this is for local temporary toasts if needed
      fetchNotifications();
    } else {
      const newNotification: NotificationItem = {
        id: Math.random().toString(36).substr(2, 9),
        message,
        type,
        timestamp: Date.now(),
        read: false,
      };
      
      const stored = localStorage.getItem("davinci_notifications");
      let current = [];
      if (stored) {
        try { current = JSON.parse(stored); } catch (e) {}
      }
      
      const updated = [newNotification, ...current].slice(0, 20);
      setNotifications(updated);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    }
  };

  const markAllAsRead = async () => {
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${user.id}/readAll`, { method: "PUT" });
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (e) {
        console.error("Failed to mark all as read", e);
      }
    } else {
      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    }
  };

  const clearAll = async () => {
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${user.id}/clearAll`, { method: "DELETE" });
        setNotifications([]);
      } catch (e) {
        console.error("Failed to clear notifications", e);
      }
    } else {
      setNotifications([]);
      localStorage.setItem("davinci_notifications", JSON.stringify([]));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    }
  };

  const removeNotification = async (id: string) => {
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${id}`, { method: "DELETE" });
        setNotifications(notifications.filter(n => n.id !== id));
      } catch (e) {
        console.error("Failed to delete notification", e);
      }
    } else {
      const updated = notifications.filter(n => n.id !== id);
      setNotifications(updated);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    }
  };

  const markAsRead = async (id: string) => {
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${id}/read`, { method: "PUT" });
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      } catch (e) {
        console.error("Failed to mark notification as read", e);
      }
    } else {
      const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
      setNotifications(updated);
      localStorage.setItem("davinci_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("davinci_notifications_updated"));
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, addNotification, markAllAsRead, clearAll, removeNotification, markAsRead, unreadCount, isLoaded };
}
