import { trpc } from "@/lib/trpc";

/**
 * Fire-and-forget analytics tracking. Never throws — a tracking failure
 * should never break the page for a real visitor.
 */
export function useAnalyticsTracker() {
  const trackMutation = trpc.analytics.track.useMutation();

  function trackPageView(path: string) {
    trackMutation.mutate({ eventType: "page_view", path });
  }

  function trackSearch(path: string, query: string, resultCount: number) {
    if (!query) return;
    trackMutation.mutate({ eventType: "search", path, query, resultCount });
  }

  function trackCategoryView(path: string, categorySlug: string, resultCount: number) {
    trackMutation.mutate({ eventType: "category_view", path, categorySlug, resultCount });
  }

  return { trackPageView, trackSearch, trackCategoryView };
}
