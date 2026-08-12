"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  /**
   * Written by this device (a toast), not by the server.
   *
   * It decides which STORE a mutation goes to. Without it, marking a toast
   * notification read fired `PUT /api/notifications/<random-9-chars>/read`
   * against an id no row has ever had.
   */
  local?: boolean;
}

/**
 * The device-local notification store.
 *
 * ToastProvider (components/ui/Toast.tsx) appends every toast here and fires
 * LOCAL_EVENT — it calls this "notification history". It is the ONLY record
 * of the manhwa side's feedback ("added to your library", "marked as read"),
 * because those actions write no server notification.
 */
const LOCAL_KEY = "davinci_notifications";
const LOCAL_EVENT = "davinci_notifications_updated";

/** Anything that isn't a known toast bucket displays as "info". */
const asToastType = (v: unknown): ToastType =>
  v === "success" || v === "error" ? v : "info";

function readLocal(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((n: any) => n && n.id != null)
      .map((n: any) => ({
        id: String(n.id),
        message: String(n.message ?? ""),
        type: asToastType(n.type),
        rawType: typeof n.rawType === "string" ? n.rawType : asToastType(n.type),
        timestamp: Number(n.timestamp) || Date.now(),
        read: !!n.read,
        link: typeof n.link === "string" ? n.link : undefined,
        local: true,
      }));
  } catch (e) {
    console.error("Failed to parse notifications", e);
    return [];
  }
}

/** Persist the local store and tell every other mounted bell about it. */
function writeLocal(list: NotificationItem[]) {
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify(list.map(({ local, ...rest }) => rest))
    );
  } catch (e) {
    console.error("Failed to save notifications", e);
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

export function useNotifications() {
  const { user } = useUser();
  /**
   * TWO STORES, ONE LIST — and this is the whole bug.
   *
   * These used to be one piece of state filled by an either/or branch: signed
   * in → the server's rows, signed out → this device's toasts. `user` is null
   * for the first render of every page load (useUser hydrates in an effect),
   * so on EVERY mount the local branch ran first and painted the toast
   * history, and a moment later the server fetch replaced the whole array with
   * rows that never contained it. That is exactly the reported symptom: a
   * notification that shows up after a manual refresh and then vanishes.
   *
   * And because nothing listened for LOCAL_EVENT, a toast fired while you were
   * sitting on the page never reached the bell at all — which is why manhwa
   * mode looked like it had no notifications: every manhwa action (library
   * add, mark as read) reports through a toast, while the anime side writes
   * real server rows (watchlist.controller.ts) that the fetch below picks up.
   *
   * Kept apart, merged for display, mutated in the store each item came from.
   */
  const [serverNotifications, setServerNotifications] = useState<NotificationItem[]>([]);
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const notifications = useMemo(
    () => [...localNotifications, ...serverNotifications].sort((a, b) => b.timestamp - a.timestamp),
    [localNotifications, serverNotifications]
  );

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
        setServerNotifications(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  }, [user, API_URL]);

  /**
   * The local store, live. Signed in or out — a toast is this device's record
   * of something that happened either way, and dropping it on sign-in is what
   * made it look like manhwa notifications "vanish".
   *
   * `storage` covers a second tab of the same account; LOCAL_EVENT covers this
   * one (a storage event never fires in the tab that wrote it).
   */
  useEffect(() => {
    const sync = () => setLocalNotifications(readLocal());
    sync();
    setIsLoaded(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY) sync();
    };
    window.addEventListener(LOCAL_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LOCAL_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      // Signed out: nothing on the server belongs to anyone here.
      setServerNotifications([]);
      return;
    }

    fetchNotifications();

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
     * tab, so notifications still feel current where it matters — and on a
     * phone, where the tab is hidden the moment the screen locks, this is the
     * difference between a poller and a battery drain.
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
  }, [user, fetchNotifications]);

  /** Is this id one of ours (a toast) rather than a server row? */
  const isLocalId = useCallback(
    (id: string) => localNotifications.some((n) => n.id === id),
    [localNotifications]
  );

  /**
   * Every local mutation goes through here: write the store, then let the
   * event put it back into state — in THIS hook and in every other mounted
   * bell at the same time. dispatchEvent is synchronous, so the panel updates
   * in the same tick, and no state updater has to carry a side effect.
   */
  const commitLocal = useCallback((next: NotificationItem[]) => {
    writeLocal(next);
  }, []);

  /**
   * Record something that happened on THIS device.
   *
   * It used to throw the message away for signed-in users and just refetch the
   * server, which meant the caller's notification simply did not exist. It is
   * written to the local store now (the same one ToastProvider writes), and the
   * server is still refreshed in case the action produced a row there too.
   */
  const addNotification = (message: string, type: ToastType = "info") => {
    const newNotification: NotificationItem = {
      id: Math.random().toString(36).slice(2, 11),
      message,
      type,
      rawType: type,
      timestamp: Date.now(),
      read: false,
      local: true,
    };
    commitLocal([newNotification, ...localNotifications].slice(0, 20));
    if (user) fetchNotifications();
  };

  const markAllAsRead = async () => {
    commitLocal(localNotifications.map((n) => ({ ...n, read: true })));
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${user.id}/readAll`, { method: "PUT" });
        setServerNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch (e) {
        console.error("Failed to mark all as read", e);
      }
    }
  };

  const clearAll = async () => {
    commitLocal([]);
    if (user) {
      try {
        await fetch(`${API_URL}/api/notifications/${user.id}/clearAll`, { method: "DELETE" });
        setServerNotifications([]);
      } catch (e) {
        console.error("Failed to clear notifications", e);
      }
    }
  };

  const removeNotification = async (id: string) => {
    if (isLocalId(id)) {
      commitLocal(localNotifications.filter((n) => n.id !== id));
      return;
    }
    try {
      await fetch(`${API_URL}/api/notifications/${id}`, { method: "DELETE" });
      setServerNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Failed to delete notification", e);
    }
  };

  const markAsRead = async (id: string) => {
    if (isLocalId(id)) {
      commitLocal(localNotifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
      return;
    }
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, { method: "PUT" });
      setServerNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, addNotification, markAllAsRead, clearAll, removeNotification, markAsRead, unreadCount, isLoaded };
}
