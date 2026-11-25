"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { clearStoredTokens, getStoredToken } from "@/lib/api";
import { DashboardErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const subscribeNoop = () => () => {};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const logout = useLogout();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const hasToken = React.useSyncExternalStore(
    subscribeNoop,
    () => Boolean(getStoredToken()),
    () => false,
  );

  const { data: currentUser, isLoading, isError } = useCurrentUser();

  React.useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  React.useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredTokens();
      router.replace("/login");
    };
    window.addEventListener("noctowl:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("noctowl:unauthorized", handleUnauthorized);
  }, [router]);

  React.useEffect(() => {
    if (isError || (currentUser && currentUser.role !== "ADMIN")) {
      clearStoredTokens();
      router.replace("/login");
    }
  }, [currentUser, isError, router]);

  if (!hasToken || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={currentUser}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onLogout={logout}
        />

        <main className="flex-1 p-4 md:p-6">
          <DashboardErrorBoundary>{children}</DashboardErrorBoundary>
        </main>
      </div>
    </div>
  );
}
