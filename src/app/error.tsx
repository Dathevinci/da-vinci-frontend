"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The POST to http://localhost:3002 that used to live here was leftover dev
    // tooling. In production it was blocked mixed content on an HTTPS page, and
    // it reached at the VISITOR's machine, not ours — so it logged a confusing
    // console error and could never have delivered a report.
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen pt-40 pb-20 px-4 flex flex-col items-center justify-center bg-[#09090b] text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
      <h1 className="text-3xl font-black text-white mb-4">Oops! Something went wrong.</h1>
      <p className="text-slate-400 max-w-md mx-auto text-lg mb-6">
        We encountered an unexpected error while trying to load this page.
        This might be a temporary network issue or a problem with our servers.
      </p>

      {/* Show the real message. Hiding it entirely meant a user reporting a bug
          could only say "it's broken", and the actual cause had to be guessed at
          from the outside. Collapsed by default so it stays out of the way. */}
      {(error?.message || error?.digest) && (
        <details className="mb-8 w-full max-w-xl text-left">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">
            Technical details
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/50 p-3 text-left text-[11px] leading-relaxed text-red-300">
            {error.message || "(no message)"}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">
            Copy this when reporting the problem — it names what actually failed.
          </p>
        </details>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition border border-white/10"
        >
          <RotateCcw className="w-5 h-5" />
          Try Again
        </button>
        <Link 
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full font-bold transition shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)]"
        >
          <Home className="w-5 h-5" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
