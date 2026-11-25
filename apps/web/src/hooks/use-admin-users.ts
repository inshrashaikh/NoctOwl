"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";
import type {
  AdminUser,
  AdminUserDetail,
  ListUsersFilters,
  PaginatedResponse,
  Role,
} from "@/types/admin";

export function useAdminUsers(filters: ListUsersFilters = {}) {
  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: adminKeys.users(filters),
    queryFn: () => apiClient.listUsers(filters),
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string) {
  return useQuery<AdminUserDetail>({
    queryKey: adminKeys.userDetail(id),
    queryFn: () => apiClient.getUserDetail(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiClient.updateUserRole(id, role),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll() });
      void queryClient.invalidateQueries({
        queryKey: adminKeys.userDetail(variables.id),
      });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deactivateUser(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.usersAll() });
      void queryClient.invalidateQueries({
        queryKey: adminKeys.userDetail(id),
      });
    },
  });
}
