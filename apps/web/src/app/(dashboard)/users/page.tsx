"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Search, Shield, UserX } from "lucide-react";
import {
  useAdminUsers,
  useDeactivateUser,
  useUpdateUserRole,
} from "@/hooks/use-admin-users";
import { formatDate } from "@/lib/utils";
import type { AdminUser, Role } from "@/types/admin";
import { DataTable } from "@/components/data-table";
import { QueryErrorCard } from "@/components/error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function UsersPage() {
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<Role | "">("");

  const [roleConfirmUser, setRoleConfirmUser] =
    React.useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    React.useState<AdminUser | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const usersQuery = useAdminUsers({
    page,
    limit: 10,
    search: search || undefined,
    role: roleFilter || undefined,
    sortOrder: "desc",
  });

  const updateRole = useUpdateUserRole();
  const deactivateUser = useDeactivateUser();

  const handleConfirmRoleChange = async () => {
    if (!roleConfirmUser) return;
    setActionError(null);
    const nextRole: Role = roleConfirmUser.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      await updateRole.mutateAsync({ id: roleConfirmUser.id, role: nextRole });
      setRoleConfirmUser(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user role.",
      );
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionError(null);
    try {
      await deactivateUser.mutateAsync(deactivateTarget.id);
      setDeactivateTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to deactivate user.",
      );
    }
  };

  const columns: ColumnDef<AdminUser, unknown>[] = [
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">
          {row.original.phone}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => row.original.name || "—",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "ADMIN" ? "warning" : "secondary"}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "destructive"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${user.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-secondary"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActionError(null);
                setRoleConfirmUser(user);
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              {user.role === "ADMIN" ? "Make User" : "Make Admin"}
            </Button>
            {user.active && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActionError(null);
                  setDeactivateTarget(user);
                }}
              >
                <UserX className="h-3.5 w-3.5" />
                Deactivate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search users"
            placeholder="Search by phone or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as Role | "");
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
        </div>
      </div>

      {usersQuery.isError ? (
        <QueryErrorCard
          message={usersQuery.error.message}
          onRetry={() => void usersQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={usersQuery.data?.items ?? []}
          isLoading={usersQuery.isLoading}
          page={usersQuery.data?.page ?? page}
          totalPages={usersQuery.data?.totalPages ?? 1}
          totalItems={usersQuery.data?.total}
          onPageChange={setPage}
          emptyMessage="No users match the selected filters."
        />
      )}

      <Dialog
        open={Boolean(roleConfirmUser)}
        onOpenChange={(open) => !open && setRoleConfirmUser(null)}
      >
        <DialogHeader>
          <DialogTitle>Confirm Role Change</DialogTitle>
          <DialogDescription>
            {roleConfirmUser
              ? `Change ${roleConfirmUser.name || roleConfirmUser.phone} from ${roleConfirmUser.role} to ${roleConfirmUser.role === "ADMIN" ? "USER" : "ADMIN"}?`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {actionError && (
          <p className="mt-3 text-sm text-destructive">{actionError}</p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRoleConfirmUser(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmRoleChange}
            disabled={updateRole.isPending}
          >
            {updateRole.isPending ? "Updating..." : "Confirm"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <DialogHeader>
          <DialogTitle>Deactivate User</DialogTitle>
          <DialogDescription>
            {deactivateTarget
              ? `Deactivating ${deactivateTarget.name || deactivateTarget.phone} revokes future logins and token refreshes. Continue?`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {actionError && (
          <p className="mt-3 text-sm text-destructive">{actionError}</p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeactivateTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmDeactivate}
            disabled={deactivateUser.isPending}
          >
            {deactivateUser.isPending ? "Deactivating..." : "Deactivate"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
