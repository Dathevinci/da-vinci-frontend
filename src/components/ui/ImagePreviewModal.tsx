"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}

export default function ImagePreviewModal({ imageUrl, altText, onClose }: ImagePreviewModalProps) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Image Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full transition z-20 backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={imageUrl} 
            alt={altText} 
            className="w-full h-full object-contain max-h-[90vh]" 
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
