"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { Wrench, ShieldAlert, LogOut } from "lucide-react";

export default function MaintenanceOverlay() {
  const { user, isLoaded, logout } = useUser();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const res = await fetch(`${API_URL}/api/system/status`);
        const data = await res.json();
        if (data.success && data.maintenance) {
          setIsMaintenance(true);
        }
      } catch (err) {
        console.error("Failed to check maintenance status");
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Don't block while checking initially
  if (isChecking) return null;

  // If not under maintenance, render nothing
  if (!isMaintenance) return null;

  // The God Exception
  if (isLoaded && user?.username.toLowerCase() === 'dejavuh') {
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-red-600 text-white px-4 py-2 rounded-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse text-sm pointer-events-none border border-red-400">
        ⚠️ SERVER OFFLINE FOR USERS
      </div>
    );
  }

  // If under maintenance and not dejavuh, lock down the screen
  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className="relative group">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full"></div>
        <div className="relative bg-[#0a0a0a] border border-yellow-500/30 p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.15)] flex flex-col items-center text-center max-w-lg w-full">
          
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border border-yellow-500/30 relative">
            <Wrench className="w-10 h-10 text-yellow-400" />
            <ShieldAlert className="w-5 h-5 text-red-500 absolute -bottom-1 -right-1" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">Under Maintenance</h1>
          
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            The Da Vinci platform is currently undergoing highly anticipated upgrades. 
            <br/><br/>
            Our Lead Developer is currently deploying a new cinematic update. Please check back shortly!
          </p>

          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-amber-600 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '30%' }}></div>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes loading {
              0% { left: -30%; width: 30%; }
              50% { left: 100%; width: 30%; }
              100% { left: -30%; width: 30%; }
            }
          `}} />
        </div>
        
        {/* Emergency Logout for trapped developers */}
        {user && (
          <button 
            onClick={() => {
              logout();
              window.location.reload();
            }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-500 hover:text-white transition px-4 py-2 bg-white/5 rounded-full text-sm font-medium border border-white/10"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
