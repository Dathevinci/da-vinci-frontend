"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    // Check session storage to see if we've already played the intro in this session
    // The user requested it to play "only for first time not all the time"
    const hasPlayed = sessionStorage.getItem("cinematicIntroPlayed");
    
    if (!hasPlayed) {
      setShow(true);
      sessionStorage.setItem("cinematicIntroPlayed", "true");
      
      // We create the audio element only on the client side
      // Using a cinematic bass hit sound from pixabay
      const audio = new Audio("https://cdn.pixabay.com/download/audio/2022/02/15/audio_b2f9f8c6fb.mp3?filename=cinematic-deep-bass-rumble-115328.mp3");
      audio.volume = 0.5;
      audioRef.current = audio;

      // Hide intro after 4.5 seconds
      const timer = setTimeout(() => {
        setShow(false);
      }, 4500);

      return () => {
        clearTimeout(timer);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    }
  }, []);

  // Modern browsers require user interaction to play audio.
  // We'll try to play it automatically, but if it fails, we catch it.
  useEffect(() => {
    if (show && audioRef.current) {
      const playTimer = setTimeout(() => {
        audioRef.current?.play().catch(e => {
          console.log("Audio autoplay prevented by browser. User interaction needed.", e);
        });
      }, 300);
      return () => clearTimeout(playTimer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#050505] overflow-hidden"
          onClick={() => {
            if (!userInteracted) {
              setUserInteracted(true);
              audioRef.current?.play().catch(e => console.log(e));
            }
          }}
        >
          {/* Blurred Background Image */}
          <motion.div 
            initial={{ scale: 1.15, opacity: 0, filter: "blur(20px)" }}
            animate={{ scale: 1, opacity: 0.6, filter: "blur(10px)" }}
            transition={{ duration: 4.5, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <img 
              src="/bg.jpg" 
              alt="Cinematic Background" 
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Dark Overlay gradients for dramatic effect */}
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-transparent to-black opacity-80 pointer-events-none" />
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/80 via-transparent to-black/80 pointer-events-none" />

          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, filter: "brightness(2) blur(12px)", y: 20 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              filter: "brightness(1) blur(0px)",
              y: 0
            }}
            transition={{ 
              duration: 2.5, 
              ease: [0.16, 1, 0.3, 1], // Custom cinematic easing
              delay: 0.4 
            }}
            style={{ willChange: "transform, opacity, filter" }}
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
