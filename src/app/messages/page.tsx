"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Send, MessageSquare, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    username: string;
    avatar: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isRead: boolean;
  } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const targetUsername = searchParams.get("user");
  const { user: currentUser, isLoaded } = useUser();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(targetUsername || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Fetch Conversations
  useEffect(() => {
    if (!currentUser) return;
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages?userId=${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
          setConversations(data.data);
          // Auto-select first conversation if none selected
          if (!activeConversation && data.data.length > 0 && !targetUsername) {
            setActiveConversation(data.data[0].otherUser.username);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingConv(false);
      }
    };
    fetchConversations();
    
    // Poll for new conversations every 10s
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [currentUser, activeConversation, targetUsername]);

  // Fetch Messages for active conversation
  useEffect(() => {
    if (!currentUser || !activeConversation) return;
    let initialLoad = true;
    
    const fetchMessages = async () => {
      if (initialLoad) setLoadingMsgs(true);
      try {
        const res = await fetch(`${API_URL}/api/messages/${activeConversation}?currentUserId=${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
          setMessages(prev => {
            // Only scroll down if new messages arrived, OR if it's the initial load
            if (initialLoad || prev.length !== data.data.length) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }
            return data.data;
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMsgs(false);
        initialLoad = false;
      }
    };
    fetchMessages();
    
    // Poll messages every 3s
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.id, activeConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeConversation || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`${API_URL}/api/messages/${activeConversation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          content: newMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...messages, data.data]);
        setNewMessage("");
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        toast(data.message || "Failed to send message.", "error");
      }
    } catch (err) {
      console.error(err);
      toast("Error sending message. Check backend.", "error");
    } finally {
      setIsSending(false);
    }
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-50 dark:bg-[#09090b]" />;
  if (!currentUser) return (
    <div className="min-h-screen pt-24 bg-slate-50 dark:bg-[#09090b] flex flex-col items-center justify-center text-slate-900 dark:text-white">
      <MessageSquare className="w-16 h-16 text-indigo-500 mb-4" />
      <h1 className="text-2xl font-bold">Sign in to view your messages</h1>
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-12 bg-slate-50 dark:bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-4 h-[calc(100vh-8rem)]">
        <div className="bg-white/70 dark:bg-[#141414]/70 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl h-full flex overflow-hidden shadow-2xl">
          
          {/* Sidebar */}
          <div className={`w-full md:w-80 border-r border-slate-200/50 dark:border-white/5 flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-6 border-b border-slate-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-black/20">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-500" /> Inbox
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto hide-scrollbar">
              {loadingConv ? (
                <div className="p-8 text-center text-slate-500 animate-pulse">Loading conversations...</div>
              ) : conversations.length === 0 && !targetUsername ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-300">No messages yet.</p>
                  <p className="text-sm mt-2">Go to a mutual follower's profile to start a chat!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {/* Ghost Conversation */}
                  {targetUsername && !conversations.some(c => c.otherUser.username === targetUsername) && (
                    <button 
                      onClick={() => setActiveConversation(targetUsername)}
                      className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left ${activeConversation === targetUsername ? 'bg-indigo-500/10 shadow-sm border border-indigo-500/20' : 'hover:bg-slate-100/50 dark:hover:bg-white/5 border border-transparent'}`}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30">
                        {targetUsername.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{targetUsername}</h3>
                        <p className="text-sm text-indigo-500 font-medium truncate">New Conversation</p>
                      </div>
                    </button>
                  )}

                  {conversations.map(conv => {
                    const isActive = activeConversation === conv.otherUser.username;
                    const hasUnread = conv.lastMessage && conv.lastMessage.senderId !== currentUser.id && !conv.lastMessage.isRead;
                    return (
                      <button 
                        key={conv.id}
                        onClick={() => setActiveConversation(conv.otherUser.username)}
                        className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left ${isActive ? 'bg-indigo-50 dark:bg-indigo-500/10 shadow-sm border border-indigo-500/20' : 'hover:bg-slate-100/50 dark:hover:bg-white/5 border border-transparent'}`}
                      >
                        <div className="relative">
                          {conv.otherUser.avatar ? (
                            <img src={conv.otherUser.avatar} className="w-12 h-12 rounded-full object-cover shrink-0 shadow-md" />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-800 dark:to-black rounded-full flex items-center justify-center text-white shrink-0 font-bold shadow-md">
                              {conv.otherUser.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {hasUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-[#141414] rounded-full"></span>}
                        </div>
                        
                        <div className="flex-1 overflow-hidden">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h3 className={`truncate ${hasUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                              {conv.otherUser.username}
                            </h3>
                            {conv.lastMessage && (
                              <span className="text-xs text-slate-400 shrink-0 ml-2 font-medium">
                                {new Date(conv.lastMessage.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage ? (
                            <p className={`text-sm truncate ${hasUnread ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'}`}>
                              {conv.lastMessage.senderId === currentUser.id ? 'You: ' : ''}{conv.lastMessage.content}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-400 italic">No messages yet</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-black/20 ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-24 h-24 bg-white dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                  <Send className="w-10 h-10 text-indigo-500 opacity-80 translate-x-1" />
                </div>
                <h2 className="text-2xl font-black mb-2 text-slate-800 dark:text-white">Your Messages</h2>
                <p className="text-slate-500">Send private photos and messages to a friend or group.</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-slate-200/50 dark:border-white/5 flex items-center gap-4 bg-white/80 dark:bg-black/40 backdrop-blur-md">
                  <button 
                    className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition"
                    onClick={() => setActiveConversation(null)}
                  >
                    ← Back
                  </button>
                  <Link href={`/user/${activeConversation}`} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md group-hover:scale-105 transition-transform">
                      {activeConversation.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:underline decoration-2 underline-offset-4">
                        {activeConversation}
                      </h3>
                    </div>
                  </Link>
                </div>
                
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {loadingMsgs && messages.length === 0 ? (
                    <div className="flex justify-center mt-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                      <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center">
                        <span className="text-4xl">👋</span>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 dark:text-white text-lg">Say hi to {activeConversation}!</p>
                        <p className="text-sm mt-1 max-w-xs">You can only message users who mutually follow you.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.senderId === currentUser.id;
                      const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                      
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group items-end gap-2`}>
                          {!isMe && (
                            <div className="w-8 shrink-0">
                              {showAvatar ? (
                                <Link href={`/user/${msg.sender.username}`}>
                                  {msg.sender.avatar ? (
                                    <img src={msg.sender.avatar} className="w-8 h-8 rounded-full object-cover shadow-sm" />
                                  ) : (
                                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                      {msg.sender.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </Link>
                              ) : <div className="w-8" />}
                            </div>
                          )}
                          <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div 
                              className={`px-5 py-3 rounded-2xl shadow-sm relative ${
                                isMe 
                                  ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm' 
                                  : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white rounded-bl-sm border border-slate-100 dark:border-white/5'
                              }`}
                            >
                              <p className="break-words leading-relaxed">{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Chat Input */}
                <div className="p-4 bg-white/80 dark:bg-black/40 backdrop-blur-md border-t border-slate-200/50 dark:border-white/5">
                  <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto items-end">
                    <div className="flex-1 bg-slate-100/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-3xl relative focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all shadow-inner">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Message..."
                        className="w-full bg-transparent px-6 py-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSending || !newMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 shadow-lg shadow-indigo-500/20 group"
                    >
                      <Send className="w-5 h-5 group-hover:scale-110 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 bg-slate-50 dark:bg-[#09090b]" />}>
      <MessagesContent />
    </Suspense>
  );
}
