import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  scope?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

async function reportClientError(error: Error, scope: string, info: ErrorInfo) {
  try {
    await fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        scope,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        route: typeof window !== "undefined" ? window.location.pathname : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    });
  } catch {
    // Swallow telemetry errors — never let reporting break the boundary
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const scope = this.props.scope || "unknown";
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${scope}]`, error, info);
    void reportClientError(error, scope, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        id="main-content"
        tabIndex={-1}
        role="alert"
        className="min-h-screen flex items-center justify-center bg-background p-6 focus:outline-none"
      >
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>
                  An unexpected error interrupted this view. Your session is safe.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {import.meta.env.DEV && (
              <pre
                className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap"
                data-testid="text-error-details"
              >
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={this.reset} data-testid="button-error-retry">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                data-testid="button-error-reload"
              >
                Reload page
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/";
                }}
                data-testid="button-error-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Go home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
