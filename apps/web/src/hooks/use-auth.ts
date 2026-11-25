"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  apiClient,
  clearStoredTokens,
  getStoredToken,
  setStoredTokens,
} from "@/lib/api";
import { adminKeys } from "@/lib/query-keys";
import type { CurrentUser } from "@/types/admin";

export function useCurrentUser() {
  const hasToken = typeof window !== "undefined" && Boolean(getStoredToken());

  return useQuery<CurrentUser>({
    queryKey: adminKeys.authUser(),
    queryFn: () => apiClient.getMe(),
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => apiClient.requestOtp(phone),
  });
}

export function useVerifyAdminOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phone, otp }: { phone: string; otp: string }) => {
      const tokens = await apiClient.verifyOtp(phone, otp);
      setStoredTokens(tokens.accessToken, tokens.refreshToken);

      try {
        const user = await apiClient.getMe();
        if (user.role !== "ADMIN") {
          clearStoredTokens();
          throw new Error("Admin access required. This account is not an ADMIN.");
        }
        queryClient.setQueryData(adminKeys.authUser(), user);
        return user;
      } catch (err) {
        clearStoredTokens();
        throw err;
      }
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    clearStoredTokens();
    queryClient.clear();
    router.replace("/login");
  };
}
