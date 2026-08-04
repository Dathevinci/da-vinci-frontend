import { Suspense } from "react";
import MediaExplore from "@/components/media/MediaExplore";
import LoadingScreen from "@/components/ui/LoadingScreen";

// MediaExplore reads useSearchParams, which must sit inside a Suspense
// boundary or `next build` fails to prerender this route.
export default function ManhwaExplorePage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading discover" />}>
      <MediaExplore mode="manhwa" />
    </Suspense>
  );
}
