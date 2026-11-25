import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useAdminUser,
  useAdminUsers,
  useDeactivateUser,
  useUpdateUserRole,
} from "@/hooks/use-admin-users";
import { apiClient } from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";

jest.mock("@/lib/api", () => ({
  apiClient: {
    listUsers: jest.fn(),
    getUserDetail: jest.fn(),
    updateUserRole: jest.fn(),
    deactivateUser: jest.fn(),
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

describe("use-admin-users hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches paginated admin users list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const payload = {
      items: [
        {
          id: "u1",
          phone: "+15550001111",
          name: "Alice",
          email: null,
          role: "ADMIN" as const,
          active: true,
          createdAt: "2026-11-25T00:00:00.000Z",
          updatedAt: "2026-11-25T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    mockedApi.listUsers.mockResolvedValue(payload);

    const { result } = renderHook(
      () => useAdminUsers({ page: 1, limit: 10, search: "Alice" }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(mockedApi.listUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: "Alice",
    });
  });

  it("fetches user detail only when id is non-empty", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result: disabledResult } = renderHook(() => useAdminUser(""), {
      wrapper: createWrapper(queryClient),
    });
    expect(disabledResult.current.fetchStatus).toBe("idle");
    expect(mockedApi.getUserDetail).not.toHaveBeenCalled();

    const detail = {
      id: "u2",
      phone: "+15550002222",
      name: "Bob",
      email: "bob@example.com",
      role: "USER" as const,
      active: true,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
      profile: null,
      contacts: [],
      trips: [],
    };
    mockedApi.getUserDetail.mockResolvedValue(detail);

    const { result } = renderHook(() => useAdminUser("u2"), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(detail);
  });

  it("invalidates user queries after updating role", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    mockedApi.updateUserRole.mockResolvedValue({
      id: "u2",
      phone: "+15550002222",
      name: "Bob",
      email: null,
      role: "ADMIN",
      active: true,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
    });

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "u2", role: "ADMIN" });
    });

    expect(mockedApi.updateUserRole).toHaveBeenCalledWith("u2", "ADMIN");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.usersAll(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.userDetail("u2"),
    });
  });

  it("invalidates user queries after deactivating user", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    mockedApi.deactivateUser.mockResolvedValue({
      id: "u3",
      phone: "+15550003333",
      name: "Cara",
      email: null,
      role: "USER",
      active: false,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
    });

    const { result } = renderHook(() => useDeactivateUser(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("u3");
    });

    expect(mockedApi.deactivateUser).toHaveBeenCalledWith("u3");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.usersAll(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.userDetail("u3"),
    });
  });
});
