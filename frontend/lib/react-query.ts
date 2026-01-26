/**
 * React Query configuration
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
      retry: 2,
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  },
});

