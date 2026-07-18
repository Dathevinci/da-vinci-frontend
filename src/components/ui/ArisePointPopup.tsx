"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface ArisePointPopupProps {
  amount: number;
}

export default function ArisePointPopup({ amount }: ArisePointPopupProps) {
  return (
    <div className="fixed bottom-8 right-8 z-[200] pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 p-[1px] rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.4)]"
        >
          <div className="bg-[#09090b]/90 backdrop-blur-md px-6 py-4 rounded-2xl flex items-center gap-4">
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="text-purple-400"
            >
              <Sparkles className="w-8 h-8" />
            </motion.div>
            
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-widest text-purple-300 uppercase">Arise System</span>
              <span className="text-xl font-bold text-white flex items-center gap-1">
                +<motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400"
                >{amount}</motion.span> Points
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
