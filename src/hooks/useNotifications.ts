"use client";

import { useState, useEffect } from "react";
import { ToastType } from "@/components/ui/Toast";

export interface NotificationItem {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("davinci_notifications");
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse notifications", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const addNotification = (message: string, type: ToastType = "info") => {
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
    
    // Keep max 20 notifications
    const updated = [newNotification, ...current].slice(0, 20);
    setNotifications(updated);
    localStorage.setItem("davinci_notifications", JSON.stringify(updated));
    window.dispatchEvent(new Event("davinci_notifications_updated"));
  };

  const markAllAsRead = () => {
    const stored = localStorage.getItem("davinci_notifications");
    let current: NotificationItem[] = [];
    if (stored) {
      try { current = JSON.parse(stored); } catch (e) {}
    }
    const updated = current.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem("davinci_notifications", JSON.stringify(updated));
    window.dispatchEvent(new Event("davinci_notifications_updated"));
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.setItem("davinci_notifications", JSON.stringify([]));
    window.dispatchEvent(new Event("davinci_notifications_updated"));
  };

  const removeNotification = (id: string) => {
    const stored = localStorage.getItem("davinci_notifications");
    let current: NotificationItem[] = [];
    if (stored) {
      try { current = JSON.parse(stored); } catch (e) {}
    }
    const updated = current.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("davinci_notifications", JSON.stringify(updated));
    window.dispatchEvent(new Event("davinci_notifications_updated"));
  };

  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem("davinci_notifications");
      if (stored) {
        try {
          setNotifications(JSON.parse(stored));
        } catch (e) {}
      } else {
        setNotifications([]);
      }
    };
    window.addEventListener("davinci_notifications_updated", handleSync);
    return () => window.removeEventListener("davinci_notifications_updated", handleSync);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, addNotification, markAllAsRead, clearAll, removeNotification, unreadCount, isLoaded };
}
