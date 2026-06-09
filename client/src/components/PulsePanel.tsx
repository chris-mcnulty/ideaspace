import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QueryErrorState } from "@/components/QueryErrorState";
import {
  Users,
  StickyNote,
  Vote,
  ListOrdered,
  Coins,
  ClipboardList,
  Grid3x3,
  TrendingUp,
  Sailboat,
  Trophy,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ContributorStat {
  notes: number;
  votes: number;
}

interface ActivityBucket {
  t: number;
  counts: Record<string, number>;
}

interface PulseSnapshot {
  participants: { joined: number; online: number };
  totals: { ideas: number; votes: number };
  engagedByModule: Record<string, string[]>;
  enabledModules: string[];
  contributorStats: Record<string, ContributorStat>;
  participantNames: Record<string, string>;
  recentNoteTimestamps: number[];
  activitySeries: ActivityBucket[];
  generatedAt: string;
}

interface PulseView {
  participants: { joined: number; online: number };
  totals: { ideas: number; votes: number };
  engagedByModule: Record<string, Set<string>>;
  enabledModules: string[];
  contributorStats: Record<string, ContributorStat>;
  participantNames: Record<string, string>;
  recentNoteTimestamps: number[];
  activitySeries: ActivityBucket[];
}

function snapshotToView(s: PulseSnapshot): PulseView {
  const engaged: Record<string, Set<string>> = {};
  for (const [k, v] of Object.entries(s.engagedByModule)) engaged[k] = new Set(v);
  return {
    participants: { ...s.participants },
    totals: { ...s.totals },
    engagedByModule: engaged,
    enabledModules: s.enabledModules,
    contributorStats: { ...s.contributorStats },
    participantNames: { ...s.participantNames },
    recentNoteTimestamps: s.recentNoteTimestamps,
    activitySeries: (s.activitySeries ?? []).map(b => ({ t: b.t, counts: { ...b.counts } })),
  };
}

const MODULE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  ideation: { label: "Ideation", icon: StickyNote },
  "pairwise-voting": { label: "Pairwise Voting", icon: Vote },
  "stack-ranking": { label: "Stack Ranking", icon: ListOrdered },
  marketplace: { label: "Marketplace", icon: Coins },
  survey: { label: "Survey", icon: ClipboardList },
  "priority-matrix": { label: "Priority Matrix", icon: Grid3x3 },
  staircase: { label: "Staircase", icon: TrendingUp },
  sailboat: { label: "Sailboat", icon: Sailboat },
};

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function VelocitySparkline({ timestamps }: { timestamps: number[] }) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const slotMs = 30 * 1000;
  const slots = Math.floor(windowMs / slotMs);
  const buckets = useMemo(() => {
    const arr = new Array(slots).fill(0);
    for (const t of timestamps) {
      const offset = now - t;
      if (offset < 0 || offset >= windowMs) continue;
      const slot = slots - 1 - Math.floor(offset / slotMs);
      if (slot >= 0 && slot < slots) arr[slot] += 1;
    }
    return arr;
  }, [timestamps, now, slots, windowMs, slotMs]);

  const max = Math.max(1, ...buckets);
  const total = timestamps.length;
  const width = 320;
  const height = 56;
  const stepX = width / Math.max(1, slots - 1);
  const points = buckets
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  if (total === 0) {
    return (
      <div
        className="flex h-14 items-center justify-center text-xs text-muted-foreground"
        data-testid="text-velocity-empty"
      >
        No new ideas in the last 10 minutes.
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={`${total} new ideas in the last 10 minutes`}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="text-primary"
      data-testid="svg-velocity-sparkline"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

const HEATMAP_MODULE_ORDER = [
  "ideation",
  "pairwise-voting",
  "stack-ranking",
  "marketplace",
  "survey",
  "priority-matrix",
  "staircase",
  "sailboat",
] as const;

const HEATMAP_MODULE_HUE: Record<string, number> = {
  ideation: 217,
  "pairwise-voting": 280,
  "stack-ranking": 25,
  marketplace: 45,
  survey: 165,
  "priority-matrix": 350,
  staircase: 130,
  sailboat: 200,
};

function ActivityHeatmap({
  series,
  enabledModules,
  now,
}: {
  series: ActivityBucket[];
  enabledModules: string[];
  now: number;
}) {
  const { rows, minutes, max } = useMemo(() => {
    if (series.length === 0) {
      return { rows: [] as string[], minutes: [] as number[], max: 0 };
    }
    // Show modules that are enabled OR have any historical activity, in
    // canonical order. This keeps the row layout stable when a facilitator
    // toggles a module off mid-session.
    const seen = new Set<string>();
    for (const b of series) for (const k of Object.keys(b.counts)) seen.add(k);
    for (const k of enabledModules) seen.add(k);
    const orderedRows = HEATMAP_MODULE_ORDER.filter(k => seen.has(k));
    // Build a continuous minute axis from the first bucket through the
    // current minute so quiet stretches show up as gaps.
    const startMinute = Math.floor(series[0].t / 60000) * 60000;
    const endMinute = Math.max(
      Math.floor(now / 60000) * 60000,
      series[series.length - 1].t,
    );
    const minuteAxis: number[] = [];
    for (let t = startMinute; t <= endMinute; t += 60000) minuteAxis.push(t);
    let maxCount = 0;
    for (const b of series) {
      for (const k of orderedRows) {
        const c = b.counts[k] ?? 0;
        if (c > maxCount) maxCount = c;
      }
    }
    return { rows: orderedRows, minutes: minuteAxis, max: maxCount };
  }, [series, enabledModules, now]);

  if (series.length === 0 || rows.length === 0 || max === 0) {
    return (
      <div
        className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
        data-testid="text-heatmap-empty"
      >
        No participation activity recorded yet for this session.
      </div>
    );
  }

  const bucketMap = new Map<number, Record<string, number>>();
  for (const b of series) bucketMap.set(b.t, b.counts);
  const startLabel = new Date(minutes[0]).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endLabel = new Date(minutes[minutes.length - 1]).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-2" data-testid="activity-heatmap">
      <div className="overflow-x-auto">
        <div className="space-y-1 min-w-fit">
          {rows.map(moduleKey => {
            const meta = MODULE_LABELS[moduleKey] || { label: moduleKey, icon: Activity };
            const Icon = meta.icon;
            const hue = HEATMAP_MODULE_HUE[moduleKey] ?? 217;
            return (
              <div
                key={moduleKey}
                className="flex items-center gap-2"
                data-testid={`heatmap-row-${moduleKey}`}
              >
                <div className="flex w-36 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{meta.label}</span>
                </div>
                <div className="flex flex-1 gap-px">
                  {minutes.map(m => {
                    const c = bucketMap.get(m)?.[moduleKey] ?? 0;
                    const intensity = c === 0 ? 0 : 0.18 + 0.82 * (c / max);
                    const bg =
                      c === 0
                        ? undefined
                        : `hsl(${hue} 80% 50% / ${intensity.toFixed(3)})`;
                    return (
                      <div
                        key={m}
                        className={`h-4 w-1.5 rounded-sm ${c === 0 ? "bg-muted/40" : ""}`}
                        style={bg ? { backgroundColor: bg } : undefined}
                        title={`${meta.label} • ${new Date(m).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • ${c} ${c === 1 ? "event" : "events"}`}
                        data-testid={`heatmap-cell-${moduleKey}-${m}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span data-testid="text-heatmap-start">{startLabel}</span>
        <span>
          {minutes.length} {minutes.length === 1 ? "minute" : "minutes"} • peak {max}/min
        </span>
        <span data-testid="text-heatmap-end">{endLabel}</span>
      </div>
    </div>
  );
}

export interface PulseLiveEvent {
  type: string;
  data: unknown;
  seq: number;
}

export interface PulsePanelProps {
  spaceId: string;
  liveEvent?: PulseLiveEvent | null;
}

const REFETCH_EVENTS = new Set<string>([
  // Single-note delete: refetch so contributorStats / ideation engagement /
  // velocity are reconciled (we don't know the deleted note's author here).
  "note_deleted",
  "notes_deleted",
  "notes_updated",
  "notes_bulk_imported",
  "module_configured",
  "module_updated",
  "categories_updated",
  // Lifecycle events change participants.joined/online and the participantNames
  // map (new participant names need to be available for the leaderboard).
  "participant_joined",
  "participant_left",
]);

const EVENT_MODULE_MAP: Record<string, string> = {
  note_created: "ideation",
  vote_recorded: "pairwise-voting",
  ranking_submitted: "stack-ranking",
  marketplace_allocation_submitted: "marketplace",
  survey_response_submitted: "survey",
  matrix_position_updated: "priority-matrix",
  staircase_position_updated: "staircase",
  sailboat_position_updated: "sailboat",
};

function bumpActivitySeries(
  series: ActivityBucket[],
  moduleKey: string,
  now = Date.now(),
): ActivityBucket[] {
  const minute = Math.floor(now / 60000) * 60000;
  const last = series.length > 0 ? series[series.length - 1] : null;
  if (last && last.t === minute) {
    const counts = { ...last.counts, [moduleKey]: (last.counts[moduleKey] ?? 0) + 1 };
    return [...series.slice(0, -1), { t: minute, counts }];
  }
  return [...series, { t: minute, counts: { [moduleKey]: 1 } }];
}

function applyDelta(prev: PulseView, ev: PulseLiveEvent): PulseView {
  const data = (ev.data && typeof ev.data === "object" ? ev.data : {}) as Record<string, unknown>;
  const participantId = typeof data.participantId === "string" ? data.participantId : null;

  if (ev.type === "note_created") {
    const nextEngaged = { ...prev.engagedByModule };
    const nextStats = { ...prev.contributorStats };
    if (participantId) {
      const set = new Set(nextEngaged.ideation || []);
      set.add(participantId);
      nextEngaged.ideation = set;
      const cur = nextStats[participantId] || { notes: 0, votes: 0 };
      nextStats[participantId] = { notes: cur.notes + 1, votes: cur.votes };
    }
    return {
      ...prev,
      totals: { ...prev.totals, ideas: prev.totals.ideas + 1 },
      recentNoteTimestamps: [...prev.recentNoteTimestamps, Date.now()],
      engagedByModule: nextEngaged,
      contributorStats: nextStats,
      activitySeries: bumpActivitySeries(prev.activitySeries, "ideation"),
    };
  }
  // note_deleted is intentionally handled via REFETCH_EVENTS instead of a
  // local decrement: we don't know the deleted note's author, so we can't
  // keep contributorStats / ideation engagement consistent locally.
  if (ev.type === "vote_recorded") {
    const nextEngaged = { ...prev.engagedByModule };
    const nextStats = { ...prev.contributorStats };
    if (participantId) {
      const set = new Set(nextEngaged["pairwise-voting"] || []);
      set.add(participantId);
      nextEngaged["pairwise-voting"] = set;
      const cur = nextStats[participantId] || { notes: 0, votes: 0 };
      nextStats[participantId] = { notes: cur.notes, votes: cur.votes + 1 };
    }
    return {
      ...prev,
      totals: { ...prev.totals, votes: prev.totals.votes + 1 },
      engagedByModule: nextEngaged,
      contributorStats: nextStats,
      activitySeries: bumpActivitySeries(prev.activitySeries, "pairwise-voting"),
    };
  }

  const moduleKey = EVENT_MODULE_MAP[ev.type];
  if (moduleKey) {
    const nextActivity = bumpActivitySeries(prev.activitySeries, moduleKey);
    const existing = prev.engagedByModule[moduleKey];
    if (!participantId || (existing && existing.has(participantId))) {
      return { ...prev, activitySeries: nextActivity };
    }
    const updated = new Set(existing || []);
    updated.add(participantId);
    return {
      ...prev,
      engagedByModule: { ...prev.engagedByModule, [moduleKey]: updated },
      activitySeries: nextActivity,
    };
  }

  return prev;
}

function deriveTopContributors(
  stats: Record<string, ContributorStat>,
  names: Record<string, string>,
  limit = 5,
): Array<{ participantId: string; displayName: string; notes: number; votes: number }> {
  return Object.entries(stats)
    .map(([participantId, s]) => ({
      participantId,
      displayName: names[participantId] || "Anonymous",
      notes: s.notes,
      votes: s.votes,
    }))
    .filter(c => c.notes + c.votes > 0)
    .sort((a, b) => b.notes + b.votes - (a.notes + a.votes) || b.notes - a.notes)
    .slice(0, limit);
}

export default function PulsePanel({ spaceId, liveEvent }: PulsePanelProps) {
  const queryKey = useMemo(() => [`/api/spaces/${spaceId}/pulse`], [spaceId]);
  const { data, isLoading, error, refetch } = useQuery<PulseSnapshot>({
    queryKey,
    enabled: !!spaceId,
  });

  const [view, setView] = useState<PulseView | null>(null);
  useEffect(() => {
    if (data) setView(snapshotToView(data));
  }, [data]);

  const lastSeqRef = useRef<number>(-1);
  useEffect(() => {
    if (!liveEvent || liveEvent.seq === lastSeqRef.current) return;
    lastSeqRef.current = liveEvent.seq;
    setView(prev => (prev ? applyDelta(prev, liveEvent) : prev));
  }, [liveEvent]);

  // Debounced refetch (≤1/sec) for events whose effect can't be diffed locally.
  // Pending timers are only cleared on unmount so a burst of events does not
  // cancel an already-scheduled refetch.
  const lastInvalidatedAt = useRef<number>(0);
  const invalidateTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!spaceId || !liveEvent) return;
    if (!REFETCH_EVENTS.has(liveEvent.type)) return;
    if (invalidateTimer.current != null) return;
    const since = Date.now() - lastInvalidatedAt.current;
    if (since >= 1000) {
      lastInvalidatedAt.current = Date.now();
      queryClient.invalidateQueries({ queryKey });
    } else {
      invalidateTimer.current = window.setTimeout(() => {
        invalidateTimer.current = null;
        lastInvalidatedAt.current = Date.now();
        queryClient.invalidateQueries({ queryKey });
      }, 1000 - since);
    }
  }, [liveEvent, spaceId, queryKey]);

  useEffect(() => {
    return () => {
      if (invalidateTimer.current != null) {
        clearTimeout(invalidateTimer.current);
        invalidateTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setView(prev => {
        if (!prev) return prev;
        const cutoff = Date.now() - 10 * 60 * 1000;
        const trimmed = prev.recentNoteTimestamps.filter(t => t >= cutoff);
        if (trimmed.length === prev.recentNoteTimestamps.length) return prev;
        return { ...prev, recentNoteTimestamps: trimmed };
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading && !view) {
    return (
      <div className="space-y-4" data-testid="pulse-loading">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !view) {
    return (
      <QueryErrorState
        title="Couldn't load Pulse"
        description="The live analytics snapshot could not be loaded."
        onRetry={() => refetch()}
      />
    );
  }

  if (!view) return null;

  const { participants, totals, engagedByModule, enabledModules, recentNoteTimestamps, activitySeries } = view;
  const total = participants.joined;
  const sizeOf = (k: string) => engagedByModule[k]?.size ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const topContributors = deriveTopContributors(view.contributorStats, view.participantNames);

  const moduleEntries = enabledModules.map(key => ({
    key,
    engaged: sizeOf(key),
    total,
    percent: pct(sizeOf(key)),
  }));

  return (
    <div className="space-y-6" data-testid="pulse-panel">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={Users}
          label="Participants"
          value={participants.joined}
          hint={`${participants.online} online now`}
          testId="tile-participants"
        />
        <Tile
          icon={StickyNote}
          label="Ideas Submitted"
          value={totals.ideas}
          testId="tile-ideas"
        />
        <Tile
          icon={Vote}
          label="Pairwise Votes"
          value={totals.votes}
          testId="tile-votes"
        />
        <Tile
          icon={Coins}
          label="Allocations Submitted"
          value={sizeOf("marketplace")}
          hint="Distinct participants"
          testId="tile-marketplace"
        />
        <Tile
          icon={ListOrdered}
          label="Rankings Submitted"
          value={sizeOf("stack-ranking")}
          hint="Distinct participants"
          testId="tile-rankings"
        />
        <Tile
          icon={ClipboardList}
          label="Surveys Completed"
          value={sizeOf("survey")}
          hint="Distinct participants"
          testId="tile-surveys"
        />
        <Tile
          icon={Grid3x3}
          label="Matrix Participants"
          value={sizeOf("priority-matrix")}
          hint="Placed at least one item"
          testId="tile-matrix"
        />
        <Tile
          icon={TrendingUp}
          label="Staircase Participants"
          value={sizeOf("staircase")}
          hint="Placed at least one item"
          testId="tile-staircase"
        />
      </div>

      <Card data-testid="card-activity-heatmap">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Participation heatmap
          </CardTitle>
          <CardDescription>
            Activity per minute across all modules — color intensity reflects how many events
            (notes, votes, rankings, allocations, survey responses, matrix &amp; staircase placements) happened in that minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap
            series={activitySeries}
            enabledModules={enabledModules}
            now={Date.now()}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card data-testid="card-velocity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Idea velocity
            </CardTitle>
            <CardDescription>New ideas submitted in the last 10 minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3">
              <div className="text-3xl font-semibold" data-testid="text-velocity-count">
                {recentNoteTimestamps.length}
              </div>
              <div className="flex-1">
                <VelocitySparkline timestamps={recentNoteTimestamps} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-module-participation">
          <CardHeader>
            <CardTitle className="text-base">Module participation</CardTitle>
            <CardDescription>
              % of joined participants who have engaged with each active module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {moduleEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-modules-empty">
                No modules are enabled for this workspace yet.
              </p>
            ) : (
              moduleEntries.map(({ key, engaged, total: t, percent }) => {
                const meta = MODULE_LABELS[key] || { label: key, icon: Activity };
                const Icon = meta.icon;
                return (
                  <div
                    key={key}
                    className="space-y-1"
                    data-testid={`module-participation-${key}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{meta.label}</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {engaged}/{t} ({percent}%)
                      </span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-top-contributors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Top contributors
          </CardTitle>
          <CardDescription>Ranked by ideas authored plus pairwise votes cast.</CardDescription>
        </CardHeader>
        <CardContent>
          {topContributors.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-leaderboard-empty">
              No contributions yet — once participants submit ideas or vote, they'll appear here.
            </p>
          ) : (
            <ol className="space-y-2">
              {topContributors.map((c, idx) => (
                <li
                  key={c.participantId}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  data-testid={`row-contributor-${idx}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground w-6">#{idx + 1}</span>
                    <span
                      className="truncate text-sm font-medium"
                      data-testid={`text-contributor-name-${idx}`}
                    >
                      {c.displayName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" data-testid={`badge-contributor-notes-${idx}`}>
                      {c.notes} ideas
                    </Badge>
                    <Badge variant="secondary" data-testid={`badge-contributor-votes-${idx}`}>
                      {c.votes} votes
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
