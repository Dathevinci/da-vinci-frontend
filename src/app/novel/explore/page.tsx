import { Suspense } from "react";
import MediaExplore from "@/components/media/MediaExplore";
import LoadingScreen from "@/components/ui/LoadingScreen";

export default function NovelExplorePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading light novels" />}>
      <MediaExplore mode="novel" />
    </Suspense>
  );
}
