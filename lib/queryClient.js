import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403
        const msg = error?.message ?? "";
        if (msg.includes("401") || msg.includes("403")) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
