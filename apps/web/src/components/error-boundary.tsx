"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="mx-auto my-8 max-w-lg border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ||
                "An unexpected error occurred while rendering this view."}
            </p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function QueryErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">Failed to load data</p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
