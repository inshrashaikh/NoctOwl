"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, OctagonX } from "lucide-react";
import { useAdminTrips, useForceEndTrip } from "@/hooks/use-admin-trips";
import { formatDateTime } from "@/lib/utils";
import type { AdminTrip, TripStatus } from "@/types/admin";
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

function statusVariant(status: TripStatus) {
  switch (status) {
    case "ACTIVE":
      return "warning" as const;
    case "COMPLETED":
      return "success" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default function TripsPage() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<TripStatus | "">("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [forceEndTarget, setForceEndTarget] = React.useState<AdminTrip | null>(
    null,
  );
  const [actionError, setActionError] = React.useState<string | null>(null);

  const tripsQuery = useAdminTrips({
    page,
    limit: 10,
    status: status || undefined,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
  });

  const forceEndTrip = useForceEndTrip();

  const handleConfirmForceEnd = async () => {
    if (!forceEndTarget) return;
    setActionError(null);
    try {
      await forceEndTrip.mutateAsync(forceEndTarget.id);
      setForceEndTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to force-end trip.",
      );
    }
  };

  const columns: ColumnDef<AdminTrip, unknown>[] = [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.user.name || "Unknown"}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.original.user.phone}
          </p>
        </div>
      ),
    },
    {
      id: "route",
      header: "Route",
      cell: ({ row }) => (
        <div className="max-w-xs truncate text-xs">
          <span className="font-medium">
            {row.original.originAddress ||
              `${row.original.originLat.toFixed(3)}, ${row.original.originLng.toFixed(3)}`}
          </span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span>
            {row.original.destAddress ||
              `${row.original.destLat.toFixed(3)}, ${row.original.destLng.toFixed(3)}`}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "startTime",
      header: "Started",
      cell: ({ row }) =>
        formatDateTime(row.original.startTime ?? row.original.createdAt),
    },
    {
      accessorKey: "endTime",
      header: "Ended",
      cell: ({ row }) => formatDateTime(row.original.endTime),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const trip = row.original;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/trips/${trip.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-secondary"
            >
              <Eye className="h-3.5 w-3.5" />
              Inspect
            </Link>
            {trip.status === "ACTIVE" && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActionError(null);
                  setForceEndTarget(trip);
                }}
              >
                <OctagonX className="h-3.5 w-3.5" />
                Force End
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select
            aria-label="Filter by trip status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TripStatus | "");
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="PLANNED">PLANNED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        </div>

        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            From Date
          </label>
          <Input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            To Date
          </label>
          <Input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {tripsQuery.isError ? (
        <QueryErrorCard
          message={tripsQuery.error.message}
          onRetry={() => void tripsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={tripsQuery.data?.items ?? []}
          isLoading={tripsQuery.isLoading}
          page={tripsQuery.data?.page ?? page}
          totalPages={tripsQuery.data?.totalPages ?? 1}
          totalItems={tripsQuery.data?.total}
          onPageChange={setPage}
          emptyMessage="No trips match the selected filters."
        />
      )}

      <Dialog
        open={Boolean(forceEndTarget)}
        onOpenChange={(open) => !open && setForceEndTarget(null)}
      >
        <DialogHeader>
          <DialogTitle>Force End Active Trip</DialogTitle>
          <DialogDescription>
            This will immediately transition the trip to CANCELLED and stamp the
            end time. Continue?
          </DialogDescription>
        </DialogHeader>
        {actionError && (
          <p className="mt-3 text-sm text-destructive">{actionError}</p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setForceEndTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmForceEnd}
            disabled={forceEndTrip.isPending}
          >
            {forceEndTrip.isPending ? "Ending..." : "Force End Trip"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
