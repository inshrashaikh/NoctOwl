import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useAnalyticsOverview,
  useNotificationStats,
  useRiskDistribution,
  useTripStats,
} from "@/hooks/use-admin-analytics";
import {
  useAdminTrip,
  useAdminTrips,
  useForceEndTrip,
} from "@/hooks/use-admin-trips";
import { apiClient } from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";

jest.mock("@/lib/api", () => ({
  apiClient: {
    listTrips: jest.fn(),
    getTripDetail: jest.fn(),
    forceEndTrip: jest.fn(),
    getAnalyticsOverview: jest.fn(),
    getTripStats: jest.fn(),
    getRiskDistribution: jest.fn(),
    getNotificationStats: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("admin trips and analytics hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches admin trips, trip detail, and invalidates cache on force-end", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    mockedApi.listTrips.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    mockedApi.getTripDetail.mockResolvedValue({
      id: "t1",
      userId: "u1",
      status: "ACTIVE",
      originAddress: null,
      destAddress: null,
      originLat: 1,
      originLng: 2,
      destLat: 3,
      destLng: 4,
      startTime: null,
      endTime: null,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
      user: { id: "u1", phone: "+1555", name: "Alice", email: null },
      locations: [],
      riskAssessments: [],
      notifications: [],
      geofenceEvents: [],
    });
    mockedApi.forceEndTrip.mockResolvedValue({
      id: "t1",
      userId: "u1",
      status: "CANCELLED",
      originAddress: null,
      destAddress: null,
      originLat: 1,
      originLng: 2,
      destLat: 3,
      destLng: 4,
      startTime: null,
      endTime: "2026-11-25T01:00:00.000Z",
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T01:00:00.000Z",
      user: { id: "u1", phone: "+1555", name: "Alice" },
    });

    const { result: listHook } = renderHook(
      () => useAdminTrips({ status: "ACTIVE" }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(listHook.current.isSuccess).toBe(true));

    const { result: detailHook } = renderHook(() => useAdminTrip("t1"), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(detailHook.current.isSuccess).toBe(true));

    const { result: mutationHook } = renderHook(() => useForceEndTrip(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await mutationHook.current.mutateAsync("t1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.tripsAll(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.tripDetail("t1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.analyticsAll(),
    });
  });

  it("fetches analytics overview, trip stats, risk buckets, and notification stats", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockedApi.getAnalyticsOverview.mockResolvedValue({
      totalUsers: 5,
      activeTripsToday: 1,
      notifications: { total: 4, sent: 1, delivered: 2, failed: 1 },
      avgRiskScore: 0.42,
    });
    mockedApi.getTripStats.mockResolvedValue({
      totalTrips: 3,
      byStatus: { PLANNED: 0, ACTIVE: 1, COMPLETED: 2, CANCELLED: 0 },
      tripsPerDay: [{ date: "2026-11-25", count: 3 }],
      avgDurationMinutes: 25,
    });
    mockedApi.getRiskDistribution.mockResolvedValue([
      { bucket: "0.0-0.2", count: 2 },
    ]);
    mockedApi.getNotificationStats.mockResolvedValue({
      total: 4,
      pending: 0,
      sent: 1,
      delivered: 2,
      failed: 1,
      deliveryRate: 50,
      failureReasons: [{ reason: "No token", count: 1 }],
    });

    const wrapper = createWrapper(queryClient);
    const { result: overview } = renderHook(() => useAnalyticsOverview(), {
      wrapper,
    });
    const { result: trips } = renderHook(() => useTripStats(), { wrapper });
    const { result: risk } = renderHook(() => useRiskDistribution(), {
      wrapper,
    });
    const { result: notifs } = renderHook(() => useNotificationStats(), {
      wrapper,
    });

    await waitFor(() => {
      expect(overview.current.isSuccess).toBe(true);
      expect(trips.current.isSuccess).toBe(true);
      expect(risk.current.isSuccess).toBe(true);
      expect(notifs.current.isSuccess).toBe(true);
    });
  });
});
