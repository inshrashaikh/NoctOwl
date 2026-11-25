import type {
  AdminTrip,
  AdminTripDetail,
  AdminUser,
  AdminUserDetail,
  AnalyticsOverview,
  AuthRequestOtpResponse,
  AuthVerifyResponse,
  CurrentUser,
  DateRangeFilters,
  ListTripsFilters,
  ListUsersFilters,
  NotificationDeliveryStatsResponse,
  PaginatedResponse,
  RiskBucketItem,
  Role,
  TripStatsResponse,
} from "@/types/admin";

const TOKEN_STORAGE_KEY = "noctowl_admin_access_token";
const REFRESH_STORAGE_KEY = "noctowl_admin_refresh_token";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
  }
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_STORAGE_KEY);
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function requestJson<T>(
  path: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { skipAuthRedirect, headers, ...rest } = options;
  const token = getStoredToken();

  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has("Content-Type") && rest.body) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (token && !mergedHeaders.has("Authorization")) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (response.status === 401 && !skipAuthRedirect) {
    clearStoredTokens();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.dispatchEvent(new Event("noctowl:unauthorized"));
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let details: unknown;
    try {
      const errorBody = (await response.json()) as {
        message?: string | string[];
      };
      details = errorBody;
      if (Array.isArray(errorBody.message)) {
        message = errorBody.message.join(", ");
      } else if (typeof errorBody.message === "string") {
        message = errorBody.message;
      }
    } catch {
      // Ignore JSON parse errors on non-JSON error responses
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  requestOtp(phone: string): Promise<AuthRequestOtpResponse> {
    return requestJson<AuthRequestOtpResponse>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
      skipAuthRedirect: true,
    });
  },

  verifyOtp(phone: string, otp: string): Promise<AuthVerifyResponse> {
    return requestJson<AuthVerifyResponse>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
      skipAuthRedirect: true,
    });
  },

  getMe(): Promise<CurrentUser> {
    return requestJson<CurrentUser>("/users/me");
  },

  listUsers(filters: ListUsersFilters = {}): Promise<PaginatedResponse<AdminUser>> {
    const query = buildQueryString({
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
      role: filters.role || undefined,
      sortOrder: filters.sortOrder,
    });
    return requestJson<PaginatedResponse<AdminUser>>(`/admin/users${query}`);
  },

  getUserDetail(id: string): Promise<AdminUserDetail> {
    return requestJson<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`);
  },

  updateUserRole(id: string, role: Role): Promise<AdminUser> {
    return requestJson<AdminUser>(`/admin/users/${encodeURIComponent(id)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  deactivateUser(id: string): Promise<AdminUser> {
    return requestJson<AdminUser>(
      `/admin/users/${encodeURIComponent(id)}/deactivate`,
      { method: "PATCH" },
    );
  },

  listTrips(filters: ListTripsFilters = {}): Promise<PaginatedResponse<AdminTrip>> {
    const query = buildQueryString({
      page: filters.page,
      limit: filters.limit,
      status: filters.status || undefined,
      userId: filters.userId,
      from: filters.from,
      to: filters.to,
    });
    return requestJson<PaginatedResponse<AdminTrip>>(`/admin/trips${query}`);
  },

  getTripDetail(id: string): Promise<AdminTripDetail> {
    return requestJson<AdminTripDetail>(`/admin/trips/${encodeURIComponent(id)}`);
  },

  forceEndTrip(id: string): Promise<AdminTrip> {
    return requestJson<AdminTrip>(
      `/admin/trips/${encodeURIComponent(id)}/force-end`,
      { method: "PATCH" },
    );
  },

  getAnalyticsOverview(range: DateRangeFilters = {}): Promise<AnalyticsOverview> {
    const query = buildQueryString({ from: range.from, to: range.to });
    return requestJson<AnalyticsOverview>(`/admin/analytics/overview${query}`);
  },

  getTripStats(range: DateRangeFilters = {}): Promise<TripStatsResponse> {
    const query = buildQueryString({ from: range.from, to: range.to });
    return requestJson<TripStatsResponse>(`/admin/analytics/trips${query}`);
  },

  getRiskDistribution(range: DateRangeFilters = {}): Promise<RiskBucketItem[]> {
    const query = buildQueryString({ from: range.from, to: range.to });
    return requestJson<RiskBucketItem[]>(`/admin/analytics/risk${query}`);
  },

  getNotificationStats(
    range: DateRangeFilters = {},
  ): Promise<NotificationDeliveryStatsResponse> {
    const query = buildQueryString({ from: range.from, to: range.to });
    return requestJson<NotificationDeliveryStatsResponse>(
      `/admin/analytics/notifications${query}`,
    );
  },

  async exportTripsCsv(range: DateRangeFilters = {}): Promise<Blob> {
    const query = buildQueryString({ from: range.from, to: range.to });
    const token = getStoredToken();
    const response = await fetch(
      `${getApiBaseUrl()}/admin/analytics/export/trips${query}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!response.ok) {
      throw new ApiError(
        `Failed to export CSV (${response.status})`,
        response.status,
      );
    }
    return response.blob();
  },
};
