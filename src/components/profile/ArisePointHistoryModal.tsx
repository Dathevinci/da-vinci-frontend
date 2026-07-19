"use client";

import { useState, useEffect } from "react";
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { motion } from "framer-motion";
import { X, Sparkles, TrendingUp, TrendingDown } from "lucide-react";

interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

// Some reasons are stored as machine-readable dedup keys (e.g. "watch:123:5",
// "finish:123", "follow:abc"). Render those as friendly text.
function prettyReason(reason: string): string {
  if (!reason) return "Arise Points";
  if (reason.startsWith("watch:")) return "Watched an episode";
  if (reason.startsWith("finish:")) return "Finished an anime";
  if (reason.startsWith("follow:")) return "Followed a user";
  return reason;
}

export default function ArisePointHistoryModal({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [loading, setLoading] = useState(true);

  useLockBodyScroll();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const res = await fetch(`${API_URL}/api/users/${userId}/point-logs`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-gradient-to-r from-purple-900/40 to-purple-900/40">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-400" /> Arise Point History
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition bg-white/5 hover:bg-white/10 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-4 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <Sparkles className="w-8 h-8 text-yellow-400 shrink-0 mt-1" />
            <div>
              <h3 className="font-black text-yellow-400 mb-1">Arise Points System</h3>
              <p className="text-sm text-yellow-200/80 leading-relaxed">
                Gain Arise Points (XP) through interactions and achievements across the platform to level up your rank and unlock new privileges.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20 text-purple-400" />
              <p>No Arise Points earned yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between bg-white/5 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition">
                  <div>
                    <p className="font-bold text-slate-200">{prettyReason(log.reason)}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                  <div className={`flex items-center gap-1 font-black text-lg ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.amount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    {log.amount > 0 ? '+' : ''}{log.amount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
