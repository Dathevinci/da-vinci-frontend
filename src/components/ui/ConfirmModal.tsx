"use client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
            
            <div className="flex items-start gap-4">
              <div className="bg-red-500/10 p-3 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight mb-1">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={onCancel}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl font-bold transition"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => { onConfirm(); onCancel(); }}
                className="flex-1 bg-red- hover:bg-red-500 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-red-600/20 transition"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
