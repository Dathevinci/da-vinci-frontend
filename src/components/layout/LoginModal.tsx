"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useUser } from "@/hooks/useUser";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { loginOrRegister } = useUser();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await loginOrRegister(username, email);
    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Failed to login. Try a unique username/email.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 max-w-md w-full relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Da Vinci Logo" className="w-16 h-16 rounded-full border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-lg p-1 mb-6">
          <button 
            type="button"
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${mode === 'login' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setMode('login')}
          >
            Log In
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${mode === 'signup' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <h2 className="text-2xl font-black mb-2 text-white text-center">
          {mode === 'login' 
            ? (username.toLowerCase() === 'dejavuh' ? 'Welcome Back, Lead Developer 👑' : 'Welcome Back') 
            : 'Join Da Vinci'}
        </h2>
        <p className="text-slate-400 mb-6 text-center text-sm">
          {mode === 'login' 
            ? (username.toLowerCase() === 'dejavuh' ? 'Your exclusive dev environment is ready.' : 'Enter your details to access your account.') 
            : 'Create an account to track your anime journey.'}
        </p>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. NarutoFan99"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. naruto@konoha.com"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 mt-4 shadow-lg shadow-indigo-500/20"
          >
            {loading ? "Connecting..." : mode === 'login' ? "Log In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
