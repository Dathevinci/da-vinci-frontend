import React from 'react';

export default function BioRenderer({ bio, className = '' }: { bio: string | null | undefined, className?: string }) {
  if (!bio) return <p className={className}>No bio set.</p>;
  
  const parts = bio.split(/(\s+)/);
  
  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\/[^\s]+(\.(gif|png|jpe?g|webp)|giphy\.com\/media\/|tenor\.com\/view\/).*$/i)) {
          return (
            <div key={i} className="my-4 flex w-full">
              <img 
                src={part} 
                alt="Bio attachment" 
                className="max-h-[250px] w-auto rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)] object-contain border border-white/10"
              />
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
