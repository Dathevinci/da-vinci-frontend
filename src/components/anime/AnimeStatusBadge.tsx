import { clsx } from "clsx";

export default function AnimeStatusBadge({ status }: { status: string }) {
  // Normalize both AniList ("RELEASING") and MAL/Kitsu ("Currently Airing")
  // status shapes to one internal key, so the badge stays consistent whichever
  // data source is serving the app.
  const normalize = (status: string): "RELEASING" | "NOT_YET_RELEASED" | "FINISHED" | "HIATUS" | "CANCELLED" | "UNKNOWN" => {
    const s = status.toLowerCase();
    if (s === "releasing" || s === "currently airing") return "RELEASING";
    if (s === "not_yet_released" || s === "not yet aired" || s === "upcoming") return "NOT_YET_RELEASED";
    if (s === "finished" || s === "finished airing" || s === "complete") return "FINISHED";
    if (s === "hiatus" || s === "on hiatus") return "HIATUS";
    if (s === "cancelled" || s === "canceled") return "CANCELLED";
    return "UNKNOWN";
  };

  const getStatusColor = (key: string) => {
    switch (key) {
      case "RELEASING":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "NOT_YET_RELEASED":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "FINISHED":
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
      case "HIATUS":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "CANCELLED":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  const getStatusText = (key: string) => {
    switch (key) {
      case "RELEASING": return "Airing Now";
      case "NOT_YET_RELEASED": return "Upcoming";
      case "FINISHED": return "Finished";
      case "HIATUS": return "On Hiatus";
      case "CANCELLED": return "Cancelled";
      default: return status;
    }
  };

  const key = normalize(status);

  // No backdrop-blur: the badge sits over an opaque cover image, so the blur
  // was invisible but added a compositing pass per card — a real scroll cost
  // multiplied across every card in every row.
  return (
    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase", getStatusColor(key))}>
      {getStatusText(key)}
    </span>
  );
}
