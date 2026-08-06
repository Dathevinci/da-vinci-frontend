"use client";

import React, { useState } from "react";
import { ReactReader } from "react-reader";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface EpubReaderProps {
  url: string;
  title: string;
  novelId: string;
}

export default function EpubReader({ url, title, novelId }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#070709]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0b0b11] px-4 py-3 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="line-clamp-1 font-mono text-sm font-bold text-white sm:text-base">{title}</h1>
        </div>
        <a
          href={url}
          download
          className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download EPUB</span>
        </a>
      </div>
      <div className="relative flex-1 bg-white">
        {/* We wrap ReactReader in a white div because EPUBs often assume white background.
            React-reader allows some customization but iframe contents are tricky to force dark without hooks. */}
        <ReactReader
          url={url}
          location={location}
          locationChanged={(epubcfi: string) => setLocation(epubcfi)}
          title={title}
          epubInitOptions={{
            openAs: "epub"
          }}
          epubOptions={{
            flow: "paginated",
            manager: "continuous"
          }}
        />
      </div>
    </div>
  );
}
