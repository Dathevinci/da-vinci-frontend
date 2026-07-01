"use client";

import { useUser } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldAlert, Zap, ServerCrash, X, RotateCcw, Trash2, Edit2, Check, Image as ImageIcon, Unlock, Activity, Users as UsersIcon, Star, Power } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function GodModeConsole() {
  const { user, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const { toast } = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    // Check initial maintenance status
    fetch(`${API_URL}/api/system/status`)
      .then(res => res.json())
      .then(data => setIsMaintenance(data.maintenance))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen && user?.username.toLowerCase() === 'dejavuh') {
      fetchUsers();
    }
  }, [isOpen, user]);

  if (!isLoaded || user?.username.toLowerCase() !== "dejavuh") return null;

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/api/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      const res = await fetch(`${API_URL}/api/system/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !isMaintenance, username: user?.username })
      });
      const data = await res.json();
      if (data.success) {
        setIsMaintenance(data.maintenance);
        toast(data.maintenance ? "Server offline (Under Maintenance)" : "Server is back ONLINE", "success");
      }
      setShowMaintenanceConfirm(false);
    } catch (err) {
      toast("Failed to toggle maintenance", "error");
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const grantPoints = async () => {
    try {
      if (user) {
         const newPoints = (user.arisePoints || 0) + 10000;
         const res = await fetch(`${API_URL}/api/users/${user.id}`, {
           method: "PATCH",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ arisePoints: newPoints })
         });
         const data = await res.json();
         if (data.success) {
           toast("Granted +10,000 Arise Points to yourself!", "success");
           await fetchUsers(); // Refresh the list
         } else {
           throw new Error("Failed to update db");
         }
      }
    } catch (e) {
      toast("Failed to grant points", "error");
    }
  };

  const nukeCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast("Local caches nuked. Reloading...", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${username}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== id));
        toast("User deleted successfully", "success");
      } else {
        toast("Failed to delete user", "error");
      }
    } catch (err) {
      toast("Error deleting user", "error");
    }
  };

  const handleUpdateUserField = async (id: string, updates: any, successMessage: string) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u));
        toast(successMessage, "success");
        return true;
      } else {
        toast("Operation failed", "error");
        return false;
      }
    } catch (err) {
      toast("Error updating user", "error");
      return false;
    }
  };

  const handleUpdatePoints = async (id: string) => {
    const success = await handleUpdateUserField(id, { arisePoints: editPoints }, "Points updated successfully");
    if (success) setEditingUserId(null);
  };

  const handleResetAvatar = async (id: string) => {
    if (!confirm("Remove this user's avatar?")) return;
    await handleUpdateUserField(id, { avatar: null }, "Avatar reset to default");
  };

  const handleForcePublic = async (id: string) => {
    if (!confirm("Force this user's profile to become public?")) return;
    await handleUpdateUserField(id, { isPrivate: false }, "Profile forced public");
  };

  const totalPoints = users
    .filter(u => u.username.toLowerCase() !== 'dejavuh')
    .reduce((acc, u) => acc + (u.arisePoints || 0), 0);
  const privateUsers = users.filter(u => u.isPrivate).length;

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            drag
            dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed z-[9999] bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-amber-500 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.6)] cursor-pointer flex items-center justify-center border-2 border-amber-300/50"
          >
            <Terminal className="w-6 h-6 text-white" />
          </motion.div>
        )}

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="w-full max-w-6xl max-h-[90vh] bg-[#09090b]/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.2)] flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-900/40 to-amber-900/40 border-b border-purple-500/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                  <span className="font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400 uppercase">God Mode Console</span>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowMaintenanceConfirm(true)}
                    disabled={togglingMaintenance}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-widest transition-all border ${
                      isMaintenance 
                        ? "bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse" 
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/20"
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    {isMaintenance ? "OFFLINE" : "ONLINE"}
                  </button>
                  <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition bg-white/5 p-2 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* Global Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-all"></div>
                    <UsersIcon className="w-8 h-8 text-blue-400 mb-4" />
                    <div className="text-4xl font-black text-white mb-1">{users.length}</div>
                    <div className="text-slate-400 font-medium">Total Registered Users</div>
                  </div>
                  
                  <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-yellow-500/20 transition-all"></div>
                    <Star className="w-8 h-8 text-yellow-400 mb-4" />
                    <div className="text-4xl font-black text-white mb-1 flex items-baseline gap-2">
                      {totalPoints.toLocaleString()}
                      <span className="text-lg text-slate-500 font-bold">/ 50k</span>
                    </div>
                    <div className="text-slate-400 font-medium">Total Arise Points Circulating</div>
                    
                    <div className="mt-4 w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                      <div 
                        className="bg-gradient-to-r from-yellow-500 to-amber-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, (totalPoints / 50000) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-yellow-500/70 mt-2 text-right font-bold tracking-widest uppercase">
                      {((totalPoints / 50000) * 100).toFixed(1)}% Claimed
                    </div>
                  </div>

                  <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-center gap-3">
                     <button 
                      onClick={grantPoints}
                      className="flex items-center justify-center gap-3 w-full px-4 py-4 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-xl font-bold transition-all"
                    >
                      <Zap className="w-5 h-5" />
                      Grant +10K Arise
                    </button>

                    <button 
                      onClick={nukeCache}
                      className="flex items-center justify-center gap-3 w-full px-4 py-4 bg-slate-800/50 border border-white/5 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Nuke Local Cache
                    </button>
                  </div>
                </div>

                {/* User Management */}
                <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-xl font-bold text-white">User Management</h2>
                    </div>
                    {loadingUsers && <span className="text-slate-400 text-sm">Loading users...</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-sm tracking-wider uppercase text-slate-400">
                          <th className="p-4 font-bold">User</th>
                          <th className="p-4 font-bold">Status</th>
                          <th className="p-4 font-bold">Points</th>
                          <th className="p-4 font-bold">Followers</th>
                          <th className="p-4 font-bold text-right">God Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition group">
                            <td className="p-4 flex items-center gap-3">
                              {u.avatar ? (
                                <img src={u.avatar} className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white border border-white/10 shadow-lg">
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-indigo-400 text-lg">{u.username}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              {u.isPrivate ? (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-xs font-bold tracking-wider uppercase">Private</span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs font-bold tracking-wider uppercase">Public</span>
                              )}
                            </td>
                            <td className="p-4">
                              {editingUserId === u.id ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    value={editPoints} 
                                    onChange={(e) => setEditPoints(parseInt(e.target.value))}
                                    className="w-24 bg-black border border-white/20 rounded px-3 py-1.5 text-white outline-none focus:border-indigo-500 shadow-inner"
                                  />
                                  <button onClick={() => handleUpdatePoints(u.id)} className="text-green-500 hover:bg-green-500/20 p-1.5 rounded transition shadow-lg"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingUserId(null)} className="text-red-500 hover:bg-red-500/20 p-1.5 rounded transition shadow-lg"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="font-black text-yellow-500 text-lg">{u.arisePoints}</span>
                                  <button 
                                    onClick={() => { setEditingUserId(u.id); setEditPoints(u.arisePoints || 0); }}
                                    className="text-slate-500 hover:text-white transition p-1 opacity-0 group-hover:opacity-100"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-slate-400 font-medium">{u.followers?.length || 0}</td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleResetAvatar(u.id)}
                                  disabled={!u.avatar}
                                  className="bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white px-3 py-1.5 rounded flex items-center justify-center gap-2 transition disabled:opacity-30 text-xs font-bold"
                                  title="Reset Avatar"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleForcePublic(u.id)}
                                  disabled={!u.isPrivate}
                                  className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded flex items-center justify-center gap-2 transition disabled:opacity-30 text-xs font-bold"
                                  title="Force Public"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  disabled={u.username.toLowerCase() === 'dejavuh'}
                                  className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded flex items-center justify-center gap-2 transition disabled:opacity-30 text-xs font-bold"
                                  title="Ban User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Must render outside the AnimatePresence that controls the modal, otherwise it gets unmounted instantly if modal closes */}
      <ConfirmModal 
        isOpen={showMaintenanceConfirm}
        title={isMaintenance ? "Turn Server Online?" : "Enable Maintenance Mode?"}
        message={isMaintenance ? "This will bring the platform back online for all users." : "WARNING: This will immediately lock all users out of the platform and show the maintenance screen. Only you will remain logged in. Proceed?"}
        confirmText={isMaintenance ? "Go Online" : "Lock Server"}
        onConfirm={toggleMaintenance}
        onCancel={() => setShowMaintenanceConfirm(false)}
      />
    </>
  );
}
