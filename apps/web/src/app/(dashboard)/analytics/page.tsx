"use client";

import * as React from "react";
import { Download } from "lucide-react";
import {
  useNotificationStats,
  useRiskDistribution,
  useTripStats,
} from "@/hooks/use-admin-analytics";
import { apiClient } from "@/lib/api";
import { DeliveryStatsChart } from "@/components/charts/delivery-stats";
import { RiskDistributionChart } from "@/components/charts/risk-distribution";
import { TripsPerDayChart } from "@/components/charts/trips-per-day";
import { QueryErrorCard } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AnalyticsPage() {
  const [tab, setTab] = React.useState("trips");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const range = React.useMemo(
    () => ({
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
    }),
    [fromDate, toDate],
  );

  const tripStats = useTripStats(range);
  const riskDist = useRiskDistribution(range);
  const notificationStats = useNotificationStats(range);

  const handleExportCsv = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await apiClient.exportTripsCsv(range);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "noctowl-trips.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export CSV.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              From Date
            </label>
            <Input
              type="date"
              aria-label="Analytics start date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              To Date
            </label>
            <Input
              type="date"
              aria-label="Analytics end date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={handleExportCsv}
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {exportError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {exportError}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4">
          {tripStats.isError ? (
            <QueryErrorCard
              message={tripStats.error.message}
              onRetry={() => void tripStats.refetch()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Trips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {tripStats.data?.totalTrips ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completed / Active
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {tripStats.data?.byStatus.COMPLETED ?? 0} /{" "}
                    {tripStats.data?.byStatus.ACTIVE ?? 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Duration (min)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {tripStats.data?.avgDurationMinutes ?? 0}
                  </CardContent>
                </Card>
              </div>
              <TripsPerDayChart
                data={tripStats.data?.tripsPerDay ?? []}
                isLoading={tripStats.isLoading}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="risk">
          {riskDist.isError ? (
            <QueryErrorCard
              message={riskDist.error.message}
              onRetry={() => void riskDist.refetch()}
            />
          ) : (
            <RiskDistributionChart
              data={riskDist.data ?? []}
              isLoading={riskDist.isLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {notificationStats.isError ? (
            <QueryErrorCard
              message={notificationStats.error.message}
              onRetry={() => void notificationStats.refetch()}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <DeliveryStatsChart
                stats={notificationStats.data}
                isLoading={notificationStats.isLoading}
              />
              <Card>
                <CardHeader>
                  <CardTitle>
                    Delivery Rate ({notificationStats.data?.deliveryRate ?? 0}%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {notificationStats.data?.failureReasons.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Failure Reason</TableHead>
                          <TableHead>Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificationStats.data.failureReasons.map((item) => (
                          <TableRow key={item.reason}>
                            <TableCell>{item.reason}</TableCell>
                            <TableCell className="font-mono">
                              {item.count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No delivery failures reported in this period.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
