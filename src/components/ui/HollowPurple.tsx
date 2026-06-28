"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function HollowPurple() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Hide animation after it finishes playing
    const timer = setTimeout(() => {
      setShow(false);
    }, 4500); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[99999] pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen"
        >
          {/* Blue Orb (Attraction) */}
          <motion.div
            initial={{ x: -300, y: -100, scale: 0.2, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
            className="absolute w-64 h-64 bg-blue-500 rounded-full blur-[60px] opacity-80"
          />
          
          {/* Red Orb (Repulsion) */}
          <motion.div
            initial={{ x: 300, y: 100, scale: 0.2, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
            className="absolute w-64 h-64 bg-red-500 rounded-full blur-[60px] opacity-80"
          />

          {/* Hollow Purple Expansion */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 8], opacity: [0, 1, 0] }}
            transition={{ delay: 1.5, duration: 2, ease: "easeIn" }}
            style={{ willChange: "transform, opacity" }}
            className="absolute w-96 h-96 bg-purple-500 rounded-full blur-[60px]"
          />
          
          {/* Core flash */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 3], opacity: [0, 1, 0] }}
            transition={{ delay: 1.5, duration: 1, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
            className="absolute w-32 h-32 bg-white rounded-full blur-[20px]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
