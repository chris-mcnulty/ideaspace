import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  testId?: string;
}

export function QueryErrorState({
  title = "Couldn't load this section",
  description,
  error,
  onRetry,
  isRetrying,
  testId = "state-query-error",
}: QueryErrorStateProps) {
  const message =
    description ||
    (error instanceof Error ? error.message : null) ||
    "Please try again in a moment.";

  return (
    <Card className="border-destructive/30" data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold" data-testid={`${testId}-title`}>
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1" data-testid={`${testId}-message`}>
              {message}
            </p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-3"
                data-testid={`${testId}-retry`}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Try again"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default QueryErrorState;
