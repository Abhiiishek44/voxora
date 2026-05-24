import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api-client";

export interface DashboardSummary {
  totalConversations: number;
  resolvedConversations: number;
  totalUsersServed: number;
  humanEscalationRate: number;
  avgResolutionTimeMs: number | null;
  widgetLoads: number;
  mostAskedQuestions: Array<{ question: string; count: number }>;
  source: {
    widget: number;
    qr: number;
  };
  aiCost: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

export interface DashboardTrends {
  conversationStatus: Array<{
    date: string;
    started: number;
    resolved: number;
    opened: number;
  }>;
  messageVolume: Array<{
    date: string;
    ai: number;
    agent: number;
  }>;
  aiCost: Array<{
    date: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      return apiClient.get<DashboardSummary>("/analytics/owner/summary");
    },
  });
}

export function useAnalyticsTrends(days = 7) {
  return useQuery({
    queryKey: ["analytics", "trends", days],
    queryFn: async () => {
      return apiClient.get<DashboardTrends>(`/analytics/owner/trends?days=${days}`);
    },
  });
}
