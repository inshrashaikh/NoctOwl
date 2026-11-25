"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, OctagonX } from "lucide-react";
import { useAdminTrip, useForceEndTrip } from "@/hooks/use-admin-trips";
import { formatDateTime, formatRiskScore } from "@/lib/utils";
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

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? "";
  const [actionError, setActionError] = React.useState<string | null>(null);

  const tripQuery = useAdminTrip(tripId);
  const forceEndTrip = useForceEndTrip();

  if (tripQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (tripQuery.isError) {
    return (
      <QueryErrorCard
        message={tripQuery.error.message}
        onRetry={() => void tripQuery.refetch()}
      />
    );
  }

  const trip = tripQuery.data;
  if (!trip) return null;

  const handleForceEnd = async () => {
    setActionError(null);
    try {
      await forceEndTrip.mutateAsync(trip.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to force-end trip.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Trips
        </Link>

        {trip.status === "ACTIVE" && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleForceEnd}
            disabled={forceEndTrip.isPending}
          >
            <OctagonX className="h-4 w-4" />
            {forceEndTrip.isPending ? "Ending..." : "Force End Trip"}
          </Button>
        )}
      </div>

      {actionError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trip Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Traveler</p>
            <p className="font-medium">{trip.user.name || trip.user.phone}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {trip.user.phone}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              <Badge variant={trip.status === "ACTIVE" ? "warning" : "outline"}>
                {trip.status}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Origin</p>
            <p className="text-sm">
              {trip.originAddress ||
                `${trip.originLat.toFixed(4)}, ${trip.originLng.toFixed(4)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Destination</p>
            <p className="text-sm">
              {trip.destAddress ||
                `${trip.destLat.toFixed(4)}, ${trip.destLng.toFixed(4)}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Risk Assessments ({trip.riskAssessments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trip.riskAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No risk assessments recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Assessed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.riskAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-mono">
                        {formatRiskScore(assessment.riskScore)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assessment.riskLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateTime(assessment.assessedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications ({trip.notifications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {trip.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notifications dispatched for this trip.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.notifications.map((notif) => (
                    <TableRow key={notif.id}>
                      <TableCell className="text-xs font-medium">
                        {notif.type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            notif.status === "FAILED"
                              ? "destructive"
                              : notif.status === "DELIVERED" ||
                                  notif.status === "ACKNOWLEDGED"
                                ? "success"
                                : "secondary"
                          }
                        >
                          {notif.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(notif.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Geofence Events ({trip.geofenceEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trip.geofenceEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No geofence events triggered.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Safe Zone</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.geofenceEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.safeZone?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.eventType}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Breadcrumbs ({trip.locations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {trip.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No GPS locations recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.locations.slice(0, 15).map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-mono text-xs">
                        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      </TableCell>
                      <TableCell>
                        {typeof loc.speed === "number"
                          ? `${loc.speed.toFixed(1)} m/s`
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDateTime(loc.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
