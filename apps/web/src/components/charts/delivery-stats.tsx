"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { NotificationDeliveryStatsResponse } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS = ["#64748b", "#3b82f6", "#10b981", "#ef4444"];

interface DeliveryStatsChartProps {
  stats: NotificationDeliveryStatsResponse | undefined;
  isLoading?: boolean;
}

export function DeliveryStatsChart({
  stats,
  isLoading = false,
}: DeliveryStatsChartProps) {
  const chartData = stats
    ? [
        { name: "Pending", value: stats.pending },
        { name: "Sent", value: stats.sent },
        { name: "Delivered", value: stats.delivered },
        { name: "Failed", value: stats.failed },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Delivery Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !stats || chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No notification deliveries recorded in this period.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[idx % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
