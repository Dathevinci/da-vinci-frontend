"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * The close X the anime view has always had, for surfaces that are PAGES
 * rather than modals — the manhwa and novel detail views. Same placement,
 * same styling as QuickViewModal's close, so the three modes feel like one
 * app instead of three.
 *
 * Close means BACK when there is a history to go back to, and the mode's
 * home when there is not (a shared link opened in a fresh tab has nothing
 * behind it — a dead X would be worse than none).
 */
export default function CloseViewButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  const close = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button
      onClick={close}
      aria-label="Close"
      className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
    >
      <X className="h-5 w-5" />
    </button>
  );
}
