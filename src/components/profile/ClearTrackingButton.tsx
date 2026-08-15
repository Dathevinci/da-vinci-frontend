"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

/**
 * "Clear all" for one profile tab's library.
 *
 * DESTRUCTIVE AND IRREVERSIBLE, so it is built to be hard to fire by accident:
 *
 *  · OWN PROFILE ONLY. The caller passes `selfView`; this renders nothing
 *    otherwise. Nobody gets a button that empties someone else's shelf, and
 *    the guard lives here as well as at the call site so a future tab cannot
 *    forget it.
 *  · NOTHING TO CLEAR, NO BUTTON. An empty library has no destructive action
 *    to offer.
 *  · CONFIRMATION NAMES THE COST — the exact count, the exact section, and the
 *    fact that saved places go with it. A dialog that only says "are you
 *    sure?" is a dialog people click through.
 *  · The button disables itself while working, so a second click cannot start
 *    a second pass over rows the first is still deleting.
 *
 * The outcome is reported honestly: partial failures are counted and said out
 * loud rather than being rounded up to success.
 */
export default function ClearTrackingButton({
  kind,
  count,
  selfView,
  onClear,
}: {
  kind: "anime" | "manhwa" | "novel";
  count: number;
  selfView: boolean;
  /** Resolves with what actually happened; a plain void return counts as all-removed. */
  onClear: () => Promise<{ removed: number; failed: number } | void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const { toast } = useToast();

  if (!selfView || count === 0) return null;

  const noun = kind === "anime" ? "anime" : kind === "manhwa" ? "manhwa" : "novels";
  const verb = kind === "anime" ? "watching" : "reading";

  const run = async () => {
    setConfirming(false);
    setWorking(true);
    try {
      const result = await onClear();
      const failed = result && typeof result === "object" ? result.failed : 0;
      const removed = result && typeof result === "object" ? result.removed : count;

      if (failed > 0) {
        toast(`Removed ${removed}, but ${failed} could not be deleted — try again`, "error");
      } else {
        toast(`Cleared ${removed} ${noun} from your library`, "success");
      }
    } catch {
      toast("Could not clear your library — nothing was changed on the server", "error");
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={working}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-300 transition hover:border-red-500/60 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        title={`Remove all ${count} tracked ${noun}`}
      >
        {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {working ? "Clearing…" : "Clear all"}
      </button>

      <ConfirmModal
        isOpen={confirming}
        title={`Clear all ${count} ${noun}?`}
        message={`This removes every ${noun.replace(/s$/, "")} from your ${kind} library, along with the ${verb} place saved for them. It cannot be undone.`}
        confirmText={`Clear ${count}`}
        cancelText="Keep them"
        danger
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
