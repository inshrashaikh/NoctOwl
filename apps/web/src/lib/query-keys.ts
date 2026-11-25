import type {
  DateRangeFilters,
  ListTripsFilters,
  ListUsersFilters,
} from "@/types/admin";

function normalizeFilters<T extends object>(filters?: T): Record<string, string | number> {
  if (!filters) return {};
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      normalized[key] = value as string | number;
    }
  }
  return normalized;
}

export const adminKeys = {
  all: ["admin"] as const,
  authUser: () => [...adminKeys.all, "auth", "me"] as const,

  usersAll: () => [...adminKeys.all, "users"] as const,
  users: (filters?: ListUsersFilters) =>
    [...adminKeys.usersAll(), normalizeFilters(filters)] as const,
  userDetail: (id: string) => [...adminKeys.usersAll(), "detail", id] as const,

  tripsAll: () => [...adminKeys.all, "trips"] as const,
  trips: (filters?: ListTripsFilters) =>
    [...adminKeys.tripsAll(), normalizeFilters(filters)] as const,
  tripDetail: (id: string) => [...adminKeys.tripsAll(), "detail", id] as const,

  analyticsAll: () => [...adminKeys.all, "analytics"] as const,
  analyticsOverview: (range?: DateRangeFilters) =>
    [...adminKeys.analyticsAll(), "overview", normalizeFilters(range)] as const,
  analyticsTrips: (range?: DateRangeFilters) =>
    [...adminKeys.analyticsAll(), "trips", normalizeFilters(range)] as const,
  analyticsRisk: (range?: DateRangeFilters) =>
    [...adminKeys.analyticsAll(), "risk", normalizeFilters(range)] as const,
  analyticsNotifications: (range?: DateRangeFilters) =>
    [
      ...adminKeys.analyticsAll(),
      "notifications",
      normalizeFilters(range),
    ] as const,
};
