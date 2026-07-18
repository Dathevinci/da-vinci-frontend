import LoadingScreen from "@/components/ui/LoadingScreen";

// App Router Suspense fallback — shown while a server-rendered route is
// fetching (notably slow cold starts on the free-tier backend).
export default function Loading() {
  return <LoadingScreen />;
}
