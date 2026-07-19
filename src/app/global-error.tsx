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
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#09090b] text-white antialiased min-h-screen">
        <div className="min-h-screen pt-40 pb-20 px-4 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black mb-4">Oops! Something went wrong.</h1>
          <p className="text-slate-400 max-w-md mx-auto text-lg mb-8">
            We encountered a critical error while trying to load the application. 
            This might be a temporary network issue or a problem with our servers.
          </p>
          
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
      </body>
    </html>
  );
}
