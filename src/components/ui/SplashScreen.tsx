"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Automatically trigger on every single reload
    const timer = setTimeout(() => {
      setShow(false);
    }, 2000); // 2 second splash so it feels snappy on reload
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
          className="fixed inset-0 z-[99999] bg-[#09090b] flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
            className="flex flex-col items-center"
          >
            <img 
              src="/logo.png" 
              alt="Da Vinci" 
              className="w-32 h-32 md:w-48 md:h-48 rounded-full shadow-[0_0_80px_rgba(99,102,241,0.6)] mb-6" 
            />
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              style={{ willChange: "transform, opacity" }}
              className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 tracking-widest"
            >
              DA VINCI
            </motion.h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
