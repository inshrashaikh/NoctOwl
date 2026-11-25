"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Shield, UserX } from "lucide-react";
import {
  useAdminUser,
  useDeactivateUser,
  useUpdateUserRole,
} from "@/hooks/use-admin-users";
import { formatDateTime } from "@/lib/utils";
import type { Role } from "@/types/admin";
import { QueryErrorCard } from "@/components/error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? "";
  const [actionError, setActionError] = React.useState<string | null>(null);

  const userQuery = useAdminUser(userId);
  const updateRole = useUpdateUserRole();
  const deactivateUser = useDeactivateUser();

  if (userQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (userQuery.isError) {
    return (
      <QueryErrorCard
        message={userQuery.error.message}
        onRetry={() => void userQuery.refetch()}
      />
    );
  }

  const user = userQuery.data;
  if (!user) return null;

  const toggleRole = async () => {
    setActionError(null);
    const nextRole: Role = user.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      await updateRole.mutateAsync({ id: user.id, role: nextRole });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user role.",
      );
    }
  };

  const handleDeactivate = async () => {
    setActionError(null);
    try {
      await deactivateUser.mutateAsync(user.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to deactivate user.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleRole}
            disabled={updateRole.isPending}
          >
            <Shield className="h-4 w-4" />
            {user.role === "ADMIN" ? "Demote to USER" : "Promote to ADMIN"}
          </Button>
          {user.active && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeactivate}
              disabled={deactivateUser.isPending}
            >
              <UserX className="h-4 w-4" />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{user.name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-mono text-sm">{user.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{user.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role &amp; Status</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={user.role === "ADMIN" ? "warning" : "secondary"}>
                {user.role}
              </Badge>
              <Badge variant={user.active ? "success" : "destructive"}>
                {user.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency Contacts ({user.contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No emergency contacts configured.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Relationship</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>{contact.priority}</TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {contact.phone}
                    </TableCell>
                    <TableCell>{contact.relationship || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Trips ({user.trips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No trips recorded for this user.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      <Badge variant="outline">{trip.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {trip.originAddress ||
                        `${trip.originLat.toFixed(4)}, ${trip.originLng.toFixed(4)}`}
                    </TableCell>
                    <TableCell>
                      {trip.destAddress ||
                        `${trip.destLat.toFixed(4)}, ${trip.destLng.toFixed(4)}`}
                    </TableCell>
                    <TableCell>{formatDateTime(trip.createdAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-xs font-medium text-amber-600 hover:underline"
                      >
                        View Trip
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
