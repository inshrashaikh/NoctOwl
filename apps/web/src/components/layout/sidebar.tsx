"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/trips", label: "Trips", icon: MapPin },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-white"
          onClick={onCloseMobile}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          {!collapsed && <span>NoctOwl</span>}
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden text-slate-400 hover:bg-slate-800 hover:text-white md:inline-flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">
          Safety Ops Console v1.0
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-slate-800 transition-all duration-200 md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {navContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 w-64">{navContent}</div>
        </div>
      )}
    </>
  );
}
