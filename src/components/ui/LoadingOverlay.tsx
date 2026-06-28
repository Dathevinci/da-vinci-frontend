import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-4" />
      <h2 className="text-2xl font-black text-white tracking-widest uppercase animate-pulse">{message}</h2>
    </div>
  );
}
