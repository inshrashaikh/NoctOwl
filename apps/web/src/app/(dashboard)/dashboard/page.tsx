"use client";

import { Activity, Bell, ShieldAlert, Users } from "lucide-react";
import {
  useAnalyticsOverview,
  useRiskDistribution,
  useTripStats,
} from "@/hooks/use-admin-analytics";
import { formatRiskScore } from "@/lib/utils";
import { RiskDistributionChart } from "@/components/charts/risk-distribution";
import { TripsPerDayChart } from "@/components/charts/trips-per-day";
import { QueryErrorCard } from "@/components/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardOverviewPage() {
  const overview = useAnalyticsOverview();
  const tripStats = useTripStats();
  const riskDist = useRiskDistribution();

  if (overview.isError) {
    return (
      <QueryErrorCard
        message={overview.error.message}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const data = overview.data;

  const cards = [
    {
      label: "Total Users",
      value: data ? String(data.totalUsers) : "0",
      subtext: "Registered NoctOwl accounts",
      icon: Users,
    },
    {
      label: "Active Trips",
      value: data ? String(data.activeTripsToday) : "0",
      subtext: "Currently in progress",
      icon: Activity,
    },
    {
      label: "Notifications Sent",
      value: data ? String(data.notifications.total) : "0",
      subtext: data
        ? `${data.notifications.delivered} delivered, ${data.notifications.failed} failed`
        : "Last 7 days",
      icon: Bell,
    },
    {
      label: "Avg Risk Score",
      value: data ? formatRiskScore(data.avgRiskScore) : "0.00",
      subtext: "Mean trip assessment (0-1)",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                {overview.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold tracking-tight">
                      {card.value}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.subtext}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {tripStats.isError ? (
          <QueryErrorCard
            message={tripStats.error.message}
            onRetry={() => void tripStats.refetch()}
          />
        ) : (
          <TripsPerDayChart
            data={tripStats.data?.tripsPerDay ?? []}
            isLoading={tripStats.isLoading}
          />
        )}

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
      </div>
    </div>
  );
}
