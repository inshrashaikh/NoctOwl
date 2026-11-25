"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";
import type {
  AdminTrip,
  AdminTripDetail,
  ListTripsFilters,
  PaginatedResponse,
} from "@/types/admin";

export function useAdminTrips(filters: ListTripsFilters = {}) {
  return useQuery<PaginatedResponse<AdminTrip>>({
    queryKey: adminKeys.trips(filters),
    queryFn: () => apiClient.listTrips(filters),
    staleTime: 30_000,
  });
}

export function useAdminTrip(id: string) {
  return useQuery<AdminTripDetail>({
    queryKey: adminKeys.tripDetail(id),
    queryFn: () => apiClient.getTripDetail(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useForceEndTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.forceEndTrip(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.tripsAll() });
      void queryClient.invalidateQueries({
        queryKey: adminKeys.tripDetail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: adminKeys.analyticsAll(),
      });
    },
  });
}
