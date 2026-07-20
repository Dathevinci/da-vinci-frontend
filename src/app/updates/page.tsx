"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/layout/PageTransition";
import UpdatePost from "@/components/updates/UpdatePost";
import { useUser } from "@/hooks/useUser";
import { Megaphone, Plus, Sparkles } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import { motion } from "framer-motion";
import CreateUpdateModal from "@/components/updates/CreateUpdateModal";

export default function UpdatesPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const canPostUpdate = isAdmin(user);

  const fetchUpdates = async () => {
    try {
      const url = new URL(`${API_URL}/api/announcements`);
      if (user) url.searchParams.append("userId", user.id);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) setUpdates(data.data || []);
    } catch (err) {
      console.error(err);
      toast("Failed to load updates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user]);

  const handleCreated = (newUpdate: any) => {
    setUpdates([newUpdate, ...updates]);
    setShowCreateModal(false);
  };

  const handleDelete = (id: string) => {
    setUpdates((prev) => prev.filter((p) => p.id !== id));
  };

  // Latest version, for the hero chip.
  const latestVersion = updates[0]?.title?.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] || null;

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-hidden bg-[#08080a] pt-24 pb-24 text-white">
        {/* ambient glows */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-purple-600/10 blur-[150px]" />
        <div className="pointer-events-none absolute top-40 right-0 h-[440px] w-[440px] translate-x-1/3 rounded-full bg-fuchsia-600/10 blur-[150px]" />

        <div className="relative z-10 mx-auto max-w-3xl px-4">
          {/* ── Hero ── */}
          <div className="relative mb-14 text-center">
            {canPostUpdate && (
              <button
                onClick={() => setShowCreateModal(true)}
                title="New update"
                className="absolute right-0 top-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_16px_rgba(168,85,247,0.4)] transition hover:scale-105"
              >
                <Plus className="h-4 w-4" /> New
              </button>
            )}
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-purple-200"
            >
              <Megaphone className="h-3.5 w-3.5" /> Changelog
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl font-black tracking-tight md:text-5xl"
            >
              Developer{" "}
              <span className="bg-gradient-to-r from-purple-300 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Updates</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-3 max-w-md text-slate-400"
            >
              Every new feature, fix and release — newest first.
            </motion.p>
            {latestVersion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18 }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-bold text-slate-200"
              >
                <Sparkles className="h-4 w-4 text-fuchsia-400" /> Latest · v{latestVersion}
              </motion.div>
            )}
          </div>

          {/* ── Timeline ── */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500" />
            </div>
          ) : updates.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Megaphone className="mx-auto mb-4 h-16 w-16 opacity-40" />
              <p className="text-xl font-bold">No updates yet</p>
              <p>Check back soon for platform news.</p>
            </div>
          ) : (
            <div className="relative">
              {/* vertical rail (desktop) */}
              <div className="pointer-events-none absolute left-[7px] top-3 bottom-3 hidden w-px bg-gradient-to-b from-purple-500/50 via-white/10 to-transparent sm:block" />
              <div className="space-y-8">
                {updates.map((update, i) => (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.3) }}
                    className="relative sm:pl-10"
                  >
                    {/* timeline dot */}
                    <div className="absolute left-0 top-6 hidden h-4 w-4 items-center justify-center rounded-full border-2 border-fuchsia-500 bg-[#08080a] shadow-[0_0_12px_rgba(217,70,239,0.6)] sm:flex">
                      <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                    </div>
                    <UpdatePost post={update} onDelete={handleDelete} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showCreateModal && (
          <CreateUpdateModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
        )}
      </div>
    </PageTransition>
  );
}
