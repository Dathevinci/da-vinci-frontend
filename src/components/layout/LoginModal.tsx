"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, signup } = useUser();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useLockBodyScroll();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    let res;
    if (mode === "login") {
      res = await login(identifier, password);
    } else {
      res = await signup(username, email, password);
    }

    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Authentication failed. Please try again.");
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
            ? (identifier.toLowerCase() === 'dejavuh' ? 'Welcome Back, Lead Developer 👑' : 'Welcome Back') 
            : 'Join Da Vinci'}
        </h2>
        <p className="text-slate-400 mb-6 text-center text-sm">
          {mode === 'login' 
            ? (identifier.toLowerCase() === 'dejavuh' ? 'Your exclusive dev environment is ready.' : 'Enter your details to access your account.') 
            : 'Create an account to track your anime journey.'}
        </p>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        {/* Discord OAuth Manual */}
        <a 
          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/discord/login`}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 rounded-lg transition shadow-lg flex items-center justify-center gap-3 mb-6"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
          Continue with Discord
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#141414] px-2 text-slate-500">Or continue with</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'login' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username or Email</label>
              <input 
                type="text" 
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                placeholder="e.g. NarutoFan99 or email@example.com"
              />
            </div>
          ) : (
            <>
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
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              placeholder="••••••••"
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
