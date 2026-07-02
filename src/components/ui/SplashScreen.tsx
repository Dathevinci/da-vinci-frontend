"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("cinematicIntroPlayed");
    
    if (!hasPlayed) {
      sessionStorage.setItem("cinematicIntroPlayed", "true");
      
      const audio = new Audio("https://cdn.pixabay.com/download/audio/2022/02/15/audio_b2f9f8c6fb.mp3?filename=cinematic-deep-bass-rumble-115328.mp3");
      audio.volume = 0.5;
      audioRef.current = audio;

      const timer = setTimeout(() => {
        setShow(false);
      }, 4500);

      setHasChecked(true);

      return () => {
        clearTimeout(timer);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    } else {
      setShow(false);
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    if (show && audioRef.current && hasChecked) {
      const playTimer = setTimeout(() => {
        audioRef.current?.play().catch(e => {
          console.log("Audio autoplay prevented by browser. User interaction needed.", e);
        });
      }, 300);
      return () => clearTimeout(playTimer);
    }
  }, [show, hasChecked]);

  // Prevent rendering if we already know it shouldn't show to avoid flashes
  if (!show && hasChecked) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash-screen-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
          onClick={() => {
            if (!userInteracted) {
              setUserInteracted(true);
              audioRef.current?.play().catch(e => console.log(e));
            }
          }}
        >
          <style>{`
            @keyframes progressiveBlur {
              0% { filter: blur(0px); opacity: 0; transform: scale(1.15); }
              20% { filter: blur(0px); opacity: 0.8; transform: scale(1.1); }
              100% { filter: blur(12px); opacity: 0.6; transform: scale(1); }
            }
          `}</style>

          {/* Background Image with CSS Animation for smooth blur and scale */}
          <div 
            className="absolute inset-0 z-0"
            style={{ animation: 'progressiveBlur 4.5s ease-out forwards' }}
          >
            <img 
              src="/bg.jpg" 
              alt="Cinematic Background" 
              className="w-full h-full object-cover"
            />
          </div>

          {/* Dark Overlay gradients for dramatic effect */}
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505] opacity-90 pointer-events-none" />
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#050505]/90 via-transparent to-[#050505]/90 pointer-events-none" />

          {/* Hollow Purple Effect Backdrop */}
          <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden mix-blend-screen">
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
          </div>

          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              y: 0
            }}
            transition={{ 
              duration: 2.5, 
              ease: [0.16, 1, 0.3, 1], // Custom cinematic easing
              delay: 0.4 
            }}
            style={{ willChange: "transform, opacity" }}
            className="relative z-10 flex flex-col items-center"
          >
            <img 
              src="/logo.png" 
              alt="Da Vinci Logo" 
              className="w-40 h-40 md:w-56 md:h-56 rounded-full shadow-[0_0_100px_rgba(99,102,241,0.5)] mb-8"
            />
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 1.2, ease: "easeOut" }}
              className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-white tracking-[0.2em] drop-shadow-2xl"
            >
              DA VINCI
            </motion.h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
