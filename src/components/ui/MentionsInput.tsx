import React, { useState, useRef, useEffect, KeyboardEvent } from "react";

interface MentionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface UserSuggestion {
  id: string;
  username: string;
  avatar: string | null;
}

export default function MentionsInput({ value, onChange, onSubmit, placeholder, className, disabled }: MentionsInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [users, setUsers] = useState<UserSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const filtered = users.filter(u => u.username.toLowerCase().includes(query)).slice(0, 6);
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setMentionStart(match.index || 0);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (username: string) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart || value.length;
    const textBefore = value.substring(0, mentionStart);
    const textAfter = value.substring(cursor);
    const newValue = `${textBefore}@${username} ${textAfter}`;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = mentionStart + username.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[selectedIndex].username);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(suggestions[selectedIndex].username);
        return;
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }

    // If no suggestions showing and Enter is pressed, submit
    if (e.key === "Enter" && !showSuggestions && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {showSuggestions && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-64 max-h-48 overflow-y-auto bg-[#18181b] border border-white/10 rounded-xl shadow-[0_5px_20px_rgba(0,0,0,0.5)]">
          {suggestions.map((user, idx) => (
            <button
              key={user.id}
              onClick={() => insertMention(user.username)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition ${idx === selectedIndex ? "bg-purple-500/20" : ""}`}
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
        </div>
      )}
    </div>
  );
}
