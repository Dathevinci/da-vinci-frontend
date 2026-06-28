import { clsx } from "clsx";

export default function AnimeStatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "RELEASING": return "Airing Now";
      case "NOT_YET_RELEASED": return "Upcoming";
      case "FINISHED": return "Finished";
      case "HIATUS": return "On Hiatus";
      case "CANCELLED": return "Cancelled";
      default: return status;
    }
  };

  return (
    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase backdrop-blur-sm", getStatusColor(status))}>
      {getStatusText(status)}
    </span>
  );
}
