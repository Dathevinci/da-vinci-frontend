import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

interface MentionsTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface UserSuggestion {
  id: string;
  username: string;
  avatar: string | null;
}

export default function MentionsTextarea({ value, onChange, placeholder, className, disabled }: MentionsTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const [dropdownPos, setDropdownPos] = useState<{top: number, left: number}>({top: 0, left: 0});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users`);
        const data = await res.json();
        if (data.success) {
          setUsers(data.data.map((u: any) => ({ id: u.id, username: u.username, avatar: u.avatar })));
        }
      } catch (e) {
        console.error("Failed to load users for mentions", e);
      }
    };
    fetchUsers();
  }, [API_URL]);

  const updateDropdownPosition = () => {
    if (!textareaRef.current) return;
    const rect = textareaRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.top + window.scrollY - 4,
      left: rect.left + window.scrollX
    });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    const cursor = e.target.selectionStart;
    const textBeforeCursor = e.target.value.substring(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const filtered = users.filter(u => u.username.toLowerCase().includes(query)).slice(0, 6);
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setMentionStart((match.index || 0) + match[0].indexOf('@'));
        setShowSuggestions(true);
        setSelectedIndex(0);
        updateDropdownPosition();
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (username: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = value.substring(0, mentionStart);
    const textAfter = value.substring(cursor);
    const newValue = `${textBefore}@${username} ${textAfter}`;
    
    const syntheticEvent = {
      target: { value: newValue }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(syntheticEvent);
    
    setShowSuggestions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = mentionStart + username.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[selectedIndex].username);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const suggestionsDropdown = showSuggestions && mounted ? createPortal(
    <div 
      className="absolute z-[9999] w-64 max-h-48 overflow-y-auto bg-[#18181b] border border-white/10 rounded-xl shadow-[0_5px_20px_rgba(0,0,0,0.5)]"
      style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, transform: 'translateY(-100%)' }}
    >
      {suggestions.map((user, idx) => (
        <button
          key={user.id}
          onClick={() => insertMention(user.username)}
          onMouseEnter={() => setSelectedIndex(idx)}
          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition ${idx === selectedIndex ? "bg-indigo-500/20" : ""}`}
          type="button"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-indigo- flex items-center justify-center text-[10px] font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm font-medium">@{user.username}</span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {suggestionsDropdown}
    </>
  );
}
