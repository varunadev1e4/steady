import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Run immediately so assertOnline() can fail loudly while offline,
      // instead of TanStack silently pausing the write.
      networkMode: 'always',
    },
  },
});
