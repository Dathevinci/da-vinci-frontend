"use client";

import { useUser } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import { ShieldAlert, Trash2, Edit2, Check, X } from "lucide-react";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (isLoaded && user?.username.toLowerCase() === 'dejavuh') {
      fetchUsers();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [user, isLoaded]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${username}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePoints = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arisePoints: editPoints })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === id ? { ...u, arisePoints: editPoints } : u));
        setEditingUserId(null);
      } else {
        alert("Failed to update points");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isLoaded || loading) return <LoadingOverlay message="Verifying credentials..." />;

  if (!user || user.username.toLowerCase() !== 'dejavuh') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <ShieldAlert className="w-24 h-24 text-red-500 mb-6 animate-pulse" />
        <h1 className="text-4xl font-black text-red-500 mb-2">ACCESS DENIED 🛑</h1>
        <p className="text-slate-400">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8 pt-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-5xl">👑</span>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              God Mode Dashboard
            </h1>
            <p className="text-slate-400">Welcome back, Lead Developer.</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-4 font-bold text-slate-300">User</th>
                  <th className="p-4 font-bold text-slate-300">Email</th>
                  <th className="p-4 font-bold text-slate-300">Arise Points</th>
                  <th className="p-4 font-bold text-slate-300">Followers</th>
                  <th className="p-4 font-bold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="p-4 flex items-center gap-3">
                      <img src={u.avatar || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=100&q=80'} className="w-10 h-10 rounded-full object-cover" />
                      <span className="font-bold text-indigo-400">{u.username}</span>
                    </td>
                    <td className="p-4 text-slate-400">{u.email}</td>
                    <td className="p-4">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={editPoints} 
                            onChange={(e) => setEditPoints(parseInt(e.target.value))}
                            className="w-20 bg-black border border-white/20 rounded px-2 py-1 text-white outline-none focus:border-indigo-500"
                          />
                          <button onClick={() => handleUpdatePoints(u.id)} className="text-green-500 hover:bg-green-500/20 p-1 rounded transition"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingUserId(null)} className="text-red-500 hover:bg-red-500/20 p-1 rounded transition"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-black text-yellow-500">{u.arisePoints}</span>
                          <button 
                            onClick={() => { setEditingUserId(u.id); setEditPoints(u.arisePoints); }}
                            className="text-slate-500 hover:text-white transition p-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">{u.followers?.length || 0}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={u.username.toLowerCase() === 'dejavuh'}
                        className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded flex items-center justify-center gap-2 ml-auto transition disabled:opacity-30 disabled:hover:bg-red-500/20 disabled:hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" /> Ban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
