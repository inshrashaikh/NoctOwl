"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";
import type {
  AnalyticsOverview,
  DateRangeFilters,
  NotificationDeliveryStatsResponse,
  RiskBucketItem,
  TripStatsResponse,
} from "@/types/admin";

export function useAnalyticsOverview(range: DateRangeFilters = {}) {
  return useQuery<AnalyticsOverview>({
    queryKey: adminKeys.analyticsOverview(range),
    queryFn: () => apiClient.getAnalyticsOverview(range),
    staleTime: 60_000,
  });
}

export function useTripStats(range: DateRangeFilters = {}) {
  return useQuery<TripStatsResponse>({
    queryKey: adminKeys.analyticsTrips(range),
    queryFn: () => apiClient.getTripStats(range),
    staleTime: 60_000,
  });
}

export function useRiskDistribution(range: DateRangeFilters = {}) {
  return useQuery<RiskBucketItem[]>({
    queryKey: adminKeys.analyticsRisk(range),
    queryFn: () => apiClient.getRiskDistribution(range),
    staleTime: 60_000,
  });
}

export function useNotificationStats(range: DateRangeFilters = {}) {
  return useQuery<NotificationDeliveryStatsResponse>({
    queryKey: adminKeys.analyticsNotifications(range),
    queryFn: () => apiClient.getNotificationStats(range),
    staleTime: 60_000,
  });
}
