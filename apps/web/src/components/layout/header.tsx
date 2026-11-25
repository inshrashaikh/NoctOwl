"use client";

import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import type { CurrentUser } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function resolveTitle(pathname: string): string {
  if (pathname.startsWith("/users/")) return "User Detail";
  if (pathname.startsWith("/users")) return "User Management";
  if (pathname.startsWith("/trips/")) return "Trip Inspection";
  if (pathname.startsWith("/trips")) return "Trip Oversight";
  if (pathname.startsWith("/analytics")) return "Analytics & Reporting";
  return "Dashboard Overview";
}

interface HeaderProps {
  user: CurrentUser | undefined;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}

export function Header({ user, onOpenMobileMenu, onLogout }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold tracking-tight md:text-lg">
          {resolveTitle(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm font-medium">
              {user.name || user.phone}
            </span>
            <Badge variant="warning">{user.role}</Badge>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
