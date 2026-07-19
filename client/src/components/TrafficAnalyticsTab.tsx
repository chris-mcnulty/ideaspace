import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, UserCheck, UserX, MonitorSmartphone, TrendingUp, Calendar, Globe } from "lucide-react";
import type { User } from "@shared/schema";

interface TrafficStats {
  totalVisits: number;
  ytdVisits: number;
  mtdVisits: number;
  weekVisits: number;
  guestVisits: number;
  registeredVisits: number;
  uniqueSessions: number;
}

interface WorkspaceTrafficRow {
  spaceId: string;
  spaceName: string;
  spaceCode: string;
  organizationName: string;
  totalVisits: number;
  guestVisits: number;
  registeredVisits: number;
  lastVisit: string | null;
}

interface DailyTrafficRow {
  date: string;
  visits: number;
}

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 flex-wrap">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TrafficAnalyticsTab({ currentUser }: { currentUser: User }) {
  const isGlobal = currentUser.role === "global_admin";

  const { data: stats, isLoading: statsLoading } = useQuery<TrafficStats>({
    queryKey: ["/api/admin/analytics/traffic"],
    staleTime: 60_000,
  });

  const { data: workspaces = [], isLoading: wsLoading } = useQuery<WorkspaceTrafficRow[]>({
    queryKey: ["/api/admin/analytics/traffic/workspaces"],
    staleTime: 60_000,
  });

  const { data: daily = [], isLoading: dailyLoading } = useQuery<DailyTrafficRow[]>({
    queryKey: ["/api/admin/analytics/traffic/daily"],
    staleTime: 60_000,
  });

  const isLoading = statsLoading || wsLoading || dailyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxDailyVisits = Math.max(...daily.map((d) => d.visits), 1);
  const maxWsVisits = Math.max(...workspaces.map((w) => w.totalVisits), 1);

  const guestPct = stats && stats.totalVisits > 0
    ? Math.round((stats.guestVisits / stats.totalVisits) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Traffic Analytics</h2>
        <p className="text-muted-foreground mt-1">
          Workspace participation data{isGlobal ? " across all organisations" : " for your organisation"}.
          {" "}Data is recorded from the moment this feature was enabled.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="YTD Visits"    value={stats?.ytdVisits    ?? 0} icon={Calendar}         sub="Jan 1 → today" />
        <StatCard label="This Month"    value={stats?.mtdVisits    ?? 0} icon={TrendingUp}        sub="Month to date" />
        <StatCard label="Last 7 Days"   value={stats?.weekVisits   ?? 0} icon={Users}             sub="Rolling 7 days" />
        <StatCard label="Unique Sessions" value={stats?.uniqueSessions ?? 0} icon={MonitorSmartphone} sub="All time" />
      </div>

      {/* Guest vs registered split */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participant Type Split</CardTitle>
          <CardDescription>Guest (no account) vs registered participants across all visits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <UserX className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <span className="text-sm font-medium">Guest</span>
                  <Badge variant="secondary">{guestPct}%</Badge>
                </div>
                <MiniBar value={stats?.guestVisits ?? 0} max={stats?.totalVisits ?? 1} />
                <p className="text-xs text-muted-foreground mt-1">{(stats?.guestVisits ?? 0).toLocaleString()} visits</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <span className="text-sm font-medium">Registered</span>
                  <Badge variant="default">{100 - guestPct}%</Badge>
                </div>
                <MiniBar value={stats?.registeredVisits ?? 0} max={stats?.totalVisits ?? 1} />
                <p className="text-xs text-muted-foreground mt-1">{(stats?.registeredVisits ?? 0).toLocaleString()} visits</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily sparkline — last 30 days */}
      {daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Visits — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-20 w-full" aria-label="Daily visits chart">
              {daily.map((d) => {
                const h = maxDailyVisits > 0 ? Math.max(2, Math.round((d.visits / maxDailyVisits) * 80)) : 2;
                return (
                  <div
                    key={d.date}
                    className="flex-1 bg-primary/70 rounded-sm transition-all hover:bg-primary"
                    style={{ height: `${h}px` }}
                    title={`${d.date}: ${d.visits} visit${d.visits !== 1 ? "s" : ""}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{daily[0]?.date ?? ""}</span>
              <span>{daily[daily.length - 1]?.date ?? ""}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {daily.length === 0 && !dailyLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No visit data yet. Visits are recorded when participants join a workspace.</p>
          </CardContent>
        </Card>
      )}

      {/* Per-workspace breakdown */}
      {workspaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visits by Workspace</CardTitle>
            <CardDescription>All-time, sorted by most visited</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {workspaces.map((w) => (
                <div key={w.spaceId} className="flex items-center gap-4 px-6 py-3 flex-wrap" data-testid={`workspace-row-${w.spaceId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.spaceName}</p>
                    <p className="text-xs text-muted-foreground">
                      {isGlobal && <span>{w.organizationName} · </span>}
                      Code: <span className="font-mono">{w.spaceCode}</span>
                      {w.lastVisit && <span className="ml-2">· Last visit {new Date(w.lastVisit).toLocaleDateString()}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 hidden sm:block">
                      <MiniBar value={w.totalVisits} max={maxWsVisits} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{w.totalVisits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.guestVisits}G · {w.registeredVisits}R
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
