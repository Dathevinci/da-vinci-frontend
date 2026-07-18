"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useRouter } from "next/navigation";

interface DiscordInviteModalProps {
  username: string;
  email: string;
  avatar?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DiscordInviteModal({ username, email, avatar, onClose, onSuccess }: DiscordInviteModalProps) {
  const { loginOrRegister } = useUser();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useLockBodyScroll();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await loginOrRegister(username, email, avatar, inviteCode);

    if (res?.success) {
      onSuccess();
    } else {
      setError(res?.message || "Authentication failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-black mb-2 text-white text-center">
          Invite Code Required
        </h2>
        <p className="text-slate-400 mb-6 text-center text-sm">
          You're almost there, {username}! Please enter an invite code to complete your registration.
        </p>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Invite Code</label>
            <input 
              type="text" 
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 uppercase"
              placeholder="e.g. A1B2C3D4"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 mt-4 shadow-lg shadow-indigo-500/20"
          >
            {loading ? "Verifying..." : "Complete Registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
