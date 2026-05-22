import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      const response = await apiClient.get<any>("/analytics/summary");
      return response.data;
    },
  });
}

export function useAnalyticsTrends(days = 7) {
  return useQuery({
    queryKey: ["analytics", "trends", days],
    queryFn: async () => {
      const response = await apiClient.get<any>(`/analytics/trends?days=${days}`);
      return response.data;
    },
  });
}
