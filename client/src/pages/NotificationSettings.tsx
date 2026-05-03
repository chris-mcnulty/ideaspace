import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_DEFAULTS,
  HIGH_PRIORITY_NOTIFICATION_TYPES,
  type NotificationType,
} from "@shared/schema";

interface PreferencesResponse {
  preferences: Record<NotificationType, boolean>;
  defaults: Record<NotificationType, boolean>;
}

const queryKey = ["/api/notification-preferences"] as const;

export default function NotificationSettings() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<PreferencesResponse>({
    queryKey: [...queryKey],
    enabled: !!user,
  });

  const [local, setLocal] = useState<Record<NotificationType, boolean> | null>(null);

  useEffect(() => {
    if (data?.preferences) setLocal({ ...data.preferences });
  }, [data?.preferences]);

  const saveMutation = useMutation({
    mutationFn: async (preferences: Record<NotificationType, boolean>) => {
      return apiRequest("PUT", "/api/notification-preferences", { preferences });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
      toast({ title: "Preferences saved" });
    },
    onError: () => {
      toast({ title: "Could not save preferences", variant: "destructive" });
    },
  });

  if (!authLoading && !user) {
    setLocation("/login");
    return null;
  }

  const dirty =
    local && data?.preferences
      ? NOTIFICATION_TYPES.some((t) => local[t] !== data.preferences[t])
      : false;

  const reset = () => {
    if (data?.preferences) setLocal({ ...data.preferences });
  };

  const restoreDefaults = () => {
    setLocal({ ...NOTIFICATION_TYPE_DEFAULTS });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-page-title">
              Notification settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose which in-app notifications you want to receive.
            </p>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-8 max-w-2xl focus:outline-none">
        <Card>
          <CardHeader>
            <CardTitle>Notification types</CardTitle>
            <CardDescription>
              Toggle each category on or off. Disabled categories will not be shown
              in your inbox or sent as live updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading || !local ? (
              <div className="space-y-3" data-testid="loading-preferences">
                {NOTIFICATION_TYPES.map((t) => (
                  <Skeleton key={t} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <ul className="divide-y">
                {NOTIFICATION_TYPES.map((type) => {
                  const meta = NOTIFICATION_TYPE_LABELS[type];
                  const isHighPriority = HIGH_PRIORITY_NOTIFICATION_TYPES.includes(type);
                  const checked = local[type];
                  return (
                    <li
                      key={type}
                      className="py-3 flex items-start justify-between gap-4"
                      data-testid={`row-pref-${type}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="text-sm font-medium"
                            data-testid={`text-pref-label-${type}`}
                          >
                            {meta.label}
                          </p>
                          {isHighPriority && (
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {meta.description}
                        </p>
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(v) =>
                          setLocal((prev) => (prev ? { ...prev, [type]: v } : prev))
                        }
                        data-testid={`switch-pref-${type}`}
                        aria-label={`Toggle ${meta.label}`}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={restoreDefaults}
            disabled={!local || saveMutation.isPending}
            data-testid="button-restore-defaults"
          >
            Restore defaults
          </Button>
          <Button
            variant="outline"
            onClick={reset}
            disabled={!dirty || saveMutation.isPending}
            data-testid="button-reset"
          >
            Reset
          </Button>
          <Button
            onClick={() => local && saveMutation.mutate(local)}
            disabled={!dirty || saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </main>
    </div>
  );
}
