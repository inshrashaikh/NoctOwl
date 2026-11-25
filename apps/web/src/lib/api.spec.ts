import {
  ApiError,
  apiClient,
  clearStoredTokens,
  getApiBaseUrl,
  getStoredToken,
  setStoredTokens,
} from "@/lib/api";

describe("apiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearStoredTokens();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("stores and clears auth tokens", () => {
    expect(getStoredToken()).toBeNull();
    setStoredTokens("access-1", "refresh-1");
    expect(getStoredToken()).toBe("access-1");
    clearStoredTokens();
    expect(getStoredToken()).toBeNull();
  });

  it("sends bearer token and query params on listUsers and listTrips", async () => {
    setStoredTokens("jwt-token");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 }),
    });

    await apiClient.listUsers({ page: 1, limit: 10, search: "bob", role: "USER" });
    expect(global.fetch).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/admin/users?page=1&limit=10&search=bob&role=USER`,
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jwt-token");

    await apiClient.listTrips({ status: "ACTIVE", page: 2 });
    expect(global.fetch).toHaveBeenLastCalledWith(
      `${getApiBaseUrl()}/admin/trips?page=2&status=ACTIVE`,
      expect.any(Object),
    );
  });

  it("throws ApiError with server message on failed responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden resource" }),
    });

    await expect(apiClient.getAnalyticsOverview()).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 403,
        message: "Forbidden resource",
      }),
    );
  });

  it("handles auth, mutations, analytics, and CSV export endpoints", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      blob: async () => new Blob(["id,status\n1,COMPLETED"], { type: "text/csv" }),
    });

    await apiClient.requestOtp("+15550001111");
    await apiClient.verifyOtp("+15550001111", "123456");
    await apiClient.getMe();
    await apiClient.getUserDetail("u1");
    await apiClient.updateUserRole("u1", "ADMIN");
    await apiClient.deactivateUser("u1");
    await apiClient.getTripDetail("t1");
    await apiClient.forceEndTrip("t1");
    await apiClient.getTripStats({ from: "2026-11-01" });
    await apiClient.getRiskDistribution();
    await apiClient.getNotificationStats();
    const blob = await apiClient.exportTripsCsv({ to: "2026-11-25" });

    expect(blob).toBeInstanceOf(Blob);
    expect(ApiError).toBeDefined();
  });
});
