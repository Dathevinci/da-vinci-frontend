"use client";

import { useState } from "react";
import { ReactReader, ReactReaderStyle, IReactReaderStyle } from "react-reader";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { lnoriFileUrl } from "@/lib/novel/lnoriProxy";

/**
 * The plain react-reader, restored.
 *
 * The custom chrome that replaced it — themes, fonts, bionic text, a contents
 * drawer, bookmarks, scrolled flow — fought epub.js at every turn and never
 * worked as well as this did. Reverted deliberately rather than patched again.
 *
 * Two things from that period are kept, because neither is a reading setting:
 *
 *  - the file address travels base64'd through the proxy, so no URL the
 *    browser sees ends in `.epub`. Download managers hook that extension and
 *    were throwing a save dialog for every volume link on the page.
 *  - the back arrow replaces rather than pushes, so the browser's own back
 *    button does not drop you straight back into the volume you just closed.
 */
interface EpubReaderProps {
  /** The real .epub address. Never rendered into a URL the browser can see. */
  file: string;
  title: string;
  novelId: string;
}

const darkReaderStyles: IReactReaderStyle = {
  ...ReactReaderStyle,
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: '#070709',
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    backgroundColor: '#070709',
  },
  tocAreaButton: {
    ...ReactReaderStyle.tocAreaButton,
    color: '#e2e8f0',
    borderBottom: '1px solid #ffffff1a',
  },
  tocButtonExpanded: {
    ...ReactReaderStyle.tocButtonExpanded,
    backgroundColor: '#1e293b',
  },
  toc: {
    ...ReactReaderStyle.toc,
    backgroundColor: '#070709',
    color: '#e2e8f0',
  },
  tocButton: {
    ...ReactReaderStyle.tocButton,
    color: '#e2e8f0',
    borderBottom: '1px solid #ffffff1a',
  },
  arrow: {
    ...ReactReaderStyle.arrow,
    color: '#e2e8f0',
    backgroundColor: '#070709',
  },
  arrowHover: {
    ...ReactReaderStyle.arrowHover,
    color: '#f8fafc',
  },
  tocBackground: {
    ...ReactReaderStyle.tocBackground,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tocButtonBar: {
    ...ReactReaderStyle.tocButtonBar,
    background: '#e2e8f0',
  },
  tocButtonBarTop: {
    ...ReactReaderStyle.tocButtonBarTop,
    background: '#e2e8f0',
  },
  tocButtonBottom: {
    ...ReactReaderStyle.tocButtonBottom,
    background: '#e2e8f0',
  }
};

export default function EpubReader({ file, title, novelId }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const url = lnoriFileUrl(file);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#070709]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0b0b11] px-4 py-3 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            href={`/novel/${encodeURIComponent(novelId)}`}
            replace
            className="rounded-full bg-white/5 p-2 text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="line-clamp-1 font-mono text-sm font-bold text-white sm:text-base">{title}</h1>
        </div>
        <a
          href={lnoriFileUrl(file, true)}
          className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 font-mono text-xs font-bold text-white transition hover:bg-pink-600"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download EPUB</span>
        </a>
      </div>
      <div className="relative flex-1 bg-[#070709]">
        <ReactReader
          url={url}
          location={location}
          locationChanged={(epubcfi: string) => setLocation(epubcfi)}
          title={title}
          getRendition={(rendition) => {
            rendition.themes.register("dark", {
              body: {
                background: "#070709 !important",
                color: "#e2e8f0 !important", // slate-200
                "font-family": "ui-sans-serif, system-ui, sans-serif !important",
              },
              p: {
                color: "#e2e8f0 !important",
                "line-height": "1.75 !important",
              },
              "h1, h2, h3, h4, h5, h6": {
                color: "#f8fafc !important", // slate-50
              },
              a: {
                color: "#f472b6 !important", // pink-400
              }
            });
            rendition.themes.select("dark");
          }}
          epubInitOptions={{
            openAs: "epub",
          }}
          epubOptions={{
            flow: "scrolled-doc",
            manager: "continuous",
          }}
          readerStyles={darkReaderStyles}
        />
      </div>
    </div>
  );
}
