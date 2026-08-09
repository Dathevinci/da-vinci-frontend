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

/**
 * CHANGELOG, in the Lunar vocabulary.
 *
 * Rebuilt to the language the redesign established on /hub: the #070709 page,
 * a font-fell display heading with an italic violet accent, mono for every
 * label and eyebrow, panels as rounded-3xl cards on #0b0b11, and one radial
 * wash instead of the old pair of blurred colour blobs. Violet leads
 * throughout — the purple → fuchsia → pink ramp belonged to the old theme.
 */
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
      <div className="relative min-h-screen overflow-hidden bg-[#070709] px-4 pb-32 pt-10 text-white sm:px-6 lg:px-10">
        {/* One radial wash from above, the hub's signature — it reads as light
            falling on the page rather than two coloured clouds behind it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_50%_80%_at_50%_-20%,rgba(139,92,246,0.22),transparent_70%)]"
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          {/* ── Hero ── */}
          <div className="relative mb-14 text-center">
            {canPostUpdate && (
              <button
                onClick={() => setShowCreateModal(true)}
                title="New update"
                className="absolute right-0 top-0 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 font-mono text-xs font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            )}

            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 font-mono text-[11px] font-bold text-violet-200"
            >
              <Megaphone className="h-3 w-3" /> Changelog
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 font-fell text-4xl text-white sm:text-5xl md:text-6xl"
            >
              Developer <em className="italic text-violet-300">Updates</em>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mx-auto mt-4 max-w-md font-mono text-sm leading-relaxed text-slate-400"
            >
              Every new feature, fix and release — newest first.
            </motion.p>

            {latestVersion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18 }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-xs font-bold text-slate-300"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                Latest
                <span className="text-white">v{latestVersion}</span>
              </motion.div>
            )}
          </div>

          {/* ── Timeline ── */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400" />
            </div>
          ) : updates.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0b0b11] px-6 py-20 text-center">
              <Megaphone className="mx-auto mb-4 h-12 w-12 text-slate-700" />
              <p className="font-fell text-2xl text-white">No updates yet</p>
              <p className="mt-2 font-mono text-sm text-slate-500">Check back soon for platform news.</p>
            </div>
          ) : (
            <div className="relative">
              {/* The rail fades out rather than stopping dead — the run of
                  releases continues below whatever is rendered. */}
              <div className="pointer-events-none absolute left-[7px] top-4 bottom-4 hidden w-px bg-gradient-to-b from-violet-500/40 via-white/10 to-transparent sm:block" />
              <div className="space-y-6">
                {updates.map((update, i) => (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.3) }}
                    className="relative sm:pl-10"
                  >
                    <div className="absolute left-0 top-8 hidden h-4 w-4 items-center justify-center rounded-full border border-violet-400/40 bg-[#070709] sm:flex">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
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
