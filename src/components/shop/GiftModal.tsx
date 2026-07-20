"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Search, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { authHeaders } from "@/lib/authToken";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type GiftItem = { id: string; name: string; price: number; gradient: string };
type UserLite = { id: string; username: string; avatar: string | null };

/**
 * Pick a recipient and gift them a shop item, paid from your own Arise Points.
 * The server does all the money/inventory work (see gift.controller); this is
 * just the picker + the POST.
 */
export default function GiftModal({
  item,
  gifterId,
  isGod,
  onClose,
  onGifted,
}: {
  item: GiftItem;
  gifterId: string;
  isGod: boolean;
  onClose: () => void;
  onGifted: (newAP: number | null) => void;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/users`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success) return;
        setUsers(
          (d.data as any[])
            .filter((u) => u.id !== gifterId)
            .map((u) => ({ id: u.id, username: u.username, avatar: u.avatar }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gifterId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? users.filter((u) => (u.username || "").toLowerCase().includes(s)) : users;
    return list.slice(0, 40);
  }, [users, q]);

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/users/gift`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ gifterId, recipientUsername: selected.username, itemId: item.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`🎁 Gifted ${item.name} to ${selected.username}!`, "success");
        onGifted(typeof data.arisePoints === "number" ? data.arisePoints : null);
        onClose();
      } else {
        toast(data.message || "Couldn't send the gift.", "error");
      }
    } catch {
      toast("Error sending the gift.", "error");
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl"
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg`}>
                <Gift className="h-5 w-5 text-white" />
              </span>
              <div>
                <h2 className="font-black leading-tight text-white">Send as a gift</h2>
                <p className="text-xs text-slate-400">
                  {item.name} · <span className="font-bold text-purple-300">{isGod ? "Free" : `${item.price.toLocaleString()} AP`}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 transition hover:text-white" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* search */}
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
                placeholder="Search a user to gift…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm transition placeholder:text-slate-500 focus:border-purple-500/60 focus:outline-none"
              />
            </div>
          </div>

          {/* recipient list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="overflow-hidden rounded-xl border border-white/5">
              {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No users found.</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      selected?.id === u.id ? "bg-purple-600/25" : "hover:bg-white/5"
                    }`}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                        {(u.username || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="flex-1 truncate font-bold text-white">{u.username}</span>
                    {selected?.id === u.id && <Check className="h-4 w-4 shrink-0 text-purple-300" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* action */}
          <div className="border-t border-white/10 p-4">
            <button
              onClick={send}
              disabled={!selected || sending}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-3 font-black text-white transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : selected ? `Gift to ${selected.username}${isGod ? "" : ` · ${item.price.toLocaleString()} AP`}` : "Pick someone to gift"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
