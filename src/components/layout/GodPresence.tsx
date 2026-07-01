"use client";

import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function GodPresence() {
  const { user, isLoaded } = useUser();
  const [particles, setParticles] = useState<{ id: number, x: number, y: number, size: number, duration: number }[]>([]);

  useEffect(() => {
    if (!isLoaded || user?.username.toLowerCase() !== "dejavuh") return;

    // Generate random particles
    const interval = setInterval(() => {
      setParticles(prev => {
        // Keep max 20 particles
        const current = prev.length > 20 ? prev.slice(1) : prev;
        return [...current, {
          id: Date.now(),
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 10 + 5,
          duration: Math.random() * 5 + 5
        }];
      });
    }, 800);

    // Add custom cursor and global active class
    document.body.classList.add('god-mode-cursor', 'god-mode-active');

    return () => {
      clearInterval(interval);
      document.body.classList.remove('god-mode-cursor', 'god-mode-active');
    };
  }, [user, isLoaded]);

  if (!isLoaded || user?.username.toLowerCase() !== "dejavuh") return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: "110vh", x: `${p.x}vw` }}
          animate={{ opacity: [0, 0.8, 0], y: "-10vh", x: `${p.x + (Math.random() * 10 - 5)}vw` }}
          transition={{ duration: p.duration, ease: "linear" }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: Math.random() > 0.5 ? "radial-gradient(circle, rgba(168,85,247,0.8) 0%, rgba(168,85,247,0) 70%)" : "radial-gradient(circle, rgba(217,70,239,0.8) 0%, rgba(217,70,239,0) 70%)",
            boxShadow: Math.random() > 0.5 ? "0 0 20px rgba(168,85,247,0.5)" : "0 0 20px rgba(217,70,239,0.5)"
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 to-fuchsia-600/10 pointer-events-none mix-blend-screen" />
    </div>
  );
}
