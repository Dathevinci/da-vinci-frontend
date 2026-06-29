"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Send, MessageSquare, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
          // If no active conversation but we have target in URL, or we want to default to the first one:
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
    const fetchMessages = async () => {
      setLoadingMsgs(true);
      try {
        const res = await fetch(`${API_URL}/api/messages/${activeConversation}?currentUserId=${currentUser.id}`);
        const data = await res.json();
        if (data.success) {
          setMessages(data.data);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMsgs(false);
      }
    };
    fetchMessages();
    
    // Poll messages every 3s
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser, activeConversation]);

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
        alert(data.message || "Failed to send message.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending message. Check backend.");
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
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl h-full flex overflow-hidden shadow-xl">
          
          {/* Sidebar */}
          <div className={`w-full md:w-80 border-r border-slate-200 dark:border-white/10 flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Messages</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConv ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : conversations.length === 0 && !targetUsername ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                  <p>No conversations yet.</p>
                  <p className="text-sm mt-2">Go to a mutual follower's profile to start a chat!</p>
                </div>
              ) : (
                <>
                  {/* If target username exists but is not in conversations list yet, show a ghost conversation */}
                  {targetUsername && !conversations.some(c => c.otherUser.username === targetUsername) && (
                    <button 
                      onClick={() => setActiveConversation(targetUsername)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition text-left border-b border-slate-100 dark:border-white/5 ${activeConversation === targetUsername ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                    >
                      <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shrink-0">
                        {targetUsername.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{targetUsername}</h3>
                        <p className="text-sm text-slate-500 truncate">New Conversation</p>
                      </div>
                    </button>
                  )}

                  {conversations.map(conv => (
                    <button 
                      key={conv.id}
                      onClick={() => setActiveConversation(conv.otherUser.username)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition text-left border-b border-slate-100 dark:border-white/5 ${activeConversation === conv.otherUser.username ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                    >
                      {conv.otherUser.avatar ? (
                        <img src={conv.otherUser.avatar} className="w-12 h-12 rounded-full object-cover shrink-0 bg-slate-200 dark:bg-slate-800" />
                      ) : (
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shrink-0 font-bold">
                          {conv.otherUser.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-bold text-slate-900 dark:text-white truncate">{conv.otherUser.username}</h3>
                          {conv.lastMessage && (
                            <span className="text-xs text-slate-400 shrink-0 ml-2">
                              {new Date(conv.lastMessage.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage ? (
                          <p className={`text-sm truncate ${conv.lastMessage.senderId !== currentUser.id && !conv.lastMessage.isRead ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'}`}>
                            {conv.lastMessage.senderId === currentUser.id ? 'You: ' : ''}{conv.lastMessage.content}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500 italic">No messages yet</p>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col bg-white dark:bg-[#141414] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                <h2 className="text-xl font-bold mb-2">Your Messages</h2>
                <p>Select a conversation or start a new one.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
                  <button 
                    className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    onClick={() => setActiveConversation(null)}
                  >
                    ← Back
                  </button>
                  <Link href={`/user/${activeConversation}`} className="font-bold text-lg text-slate-900 dark:text-white hover:underline">
                    {activeConversation}
                  </Link>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMsgs && messages.length === 0 ? (
                    <div className="text-center text-slate-500 mt-4">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10">
                      This is the beginning of your conversation with {activeConversation}.<br/>
                      <span className="text-xs">Remember: You can only message mutual followers (or yourself).</span>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.senderId === currentUser.id;
                      const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
                      
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                          {!isMe && (
                            <div className="w-8 shrink-0 mr-2">
                              {showAvatar && (
                                <Link href={`/user/${msg.sender.username}`}>
                                  {msg.sender.avatar ? (
                                    <img src={msg.sender.avatar} className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                      {msg.sender.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </Link>
                              )}
                            </div>
                          )}
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-bl-none'}`}>
                            <p className="break-words">{msg.content}</p>
                            <span className={`text-[10px] mt-1 block ${isMe ? 'text-indigo-200 text-right' : 'text-slate-500'}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-white/10 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/10 rounded-full px-6 py-3 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-full transition shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
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
