"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}

export default function ImagePreviewModal({ imageUrl, altText = "Image preview", onClose }: ImagePreviewModalProps) {
  useLockBodyScroll();
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        {/* No backdrop-filter: a full-screen blur re-renders on every frame
            anything above it moves, which is exactly the jank a phone can't
            hide. A deeper plain scrim reads the same. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 cursor-pointer"
        />

        {/* Image Container. dvh, NOT vh — static vh is measured against the
            LARGEST viewport, so with the browser bar expanded a 90vh image
            overflowed the visible screen. Whether it fit depended on scroll
            state, which is why the preview only broke "sometimes". */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 max-w-4xl max-h-[88dvh] rounded-2xl overflow-hidden shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition z-20"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={imageUrl}
            alt={altText}
            className="w-full h-full object-contain max-h-[88dvh]"
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
