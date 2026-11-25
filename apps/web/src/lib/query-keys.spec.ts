import { adminKeys } from "@/lib/query-keys";

describe("adminKeys", () => {
  it("builds stable base and auth keys", () => {
    expect(adminKeys.all).toEqual(["admin"]);
    expect(adminKeys.authUser()).toEqual(["admin", "auth", "me"]);
  });

  it("normalizes empty and undefined filters in user list keys", () => {
    expect(
      adminKeys.users({ page: 1, limit: 10, search: "", role: "" }),
    ).toEqual(["admin", "users", { page: 1, limit: 10 }]);

    expect(
      adminKeys.users({ page: 2, search: "alice", role: "ADMIN" }),
    ).toEqual([
      "admin",
      "users",
      { page: 2, search: "alice", role: "ADMIN" },
    ]);
  });

  it("builds user and trip detail keys cleanly", () => {
    expect(adminKeys.userDetail("user-1")).toEqual([
      "admin",
      "users",
      "detail",
      "user-1",
    ]);
    expect(adminKeys.tripDetail("trip-42")).toEqual([
      "admin",
      "trips",
      "detail",
      "trip-42",
    ]);
  });

  it("builds distinct analytics keys per endpoint and date range", () => {
    const range = { from: "2026-11-01", to: "2026-11-25" };
    expect(adminKeys.analyticsOverview(range)).toEqual([
      "admin",
      "analytics",
      "overview",
      range,
    ]);
    expect(adminKeys.analyticsTrips(range)).toEqual([
      "admin",
      "analytics",
      "trips",
      range,
    ]);
    expect(adminKeys.analyticsRisk()).toEqual([
      "admin",
      "analytics",
      "risk",
      {},
    ]);
    expect(adminKeys.analyticsNotifications(range)).toEqual([
      "admin",
      "analytics",
      "notifications",
      range,
    ]);
  });
});
