import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
}

const HIGH_PRIORITY_TYPES = new Set([
  "results_ready",
  "access_request_approved",
  "access_request_denied",
  "ai_generation_completed",
]);

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const queryKey = useMemo(() => ["/api/notifications"], []);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Live updates over WebSocket
  useWebSocket({
    userId: user?.id,
    enabled: !!user?.id,
    onMessage: (msg) => {
      if (msg.type !== "notification") return;
      const n = msg.data as Notification;

      // Optimistically inject into the cached list
      queryClient.setQueryData<NotificationsResponse>(queryKey, (prev) => {
        if (!prev) return { items: [n], unreadCount: 1 };
        const exists = prev.items.some((i) => i.id === n.id);
        if (exists) return prev;
        return {
          items: [n, ...prev.items].slice(0, 50),
          unreadCount: prev.unreadCount + 1,
        };
      });

      // Toast bridge for high-priority types only
      if (HIGH_PRIORITY_TYPES.has(n.type)) {
        toast({
          title: n.title,
          description: n.body || undefined,
        });
      }
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (!user) return null;

  const items = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  const handleItemClick = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) setLocation(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-bell"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full text-[10px]"
              data-testid="badge-notification-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" data-testid="text-notifications-title">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {items.length > 0 && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-3 space-y-3" data-testid="loading-notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="p-8 text-center text-sm text-muted-foreground"
              data-testid="text-no-notifications"
            >
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="w-full text-left p-3 hover-elevate active-elevate-2 flex gap-3"
                      data-testid={`item-notification-${n.id}`}
                    >
                      <div
                        className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                          isUnread ? "bg-primary" : "bg-transparent"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-snug ${
                              isUnread ? "font-semibold" : "font-normal"
                            }`}
                            data-testid={`text-notification-title-${n.id}`}
                          >
                            {n.title}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {n.body}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
