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
  Trophy,
  Activity,
} from "lucide-react";

interface PulseSnapshot {
  participants: { joined: number; online: number };
  counts: {
    ideas: number;
    votes: number;
    rankings: number;
    marketplaceAllocations: number;
    surveyResponses: number;
    matrixPlacements: number;
    staircasePlacements: number;
  };
  perModuleParticipation: Record<
    string,
    { engaged: number; total: number; percent: number }
  >;
  topContributors: Array<{
    participantId: string;
    displayName: string;
    notes: number;
    votes: number;
  }>;
  recentNoteTimestamps: number[];
  generatedAt: string;
}

const MODULE_LABELS: Record<string, { label: string; icon: any }> = {
  ideation: { label: "Ideation", icon: StickyNote },
  "pairwise-voting": { label: "Pairwise Voting", icon: Vote },
  "stack-ranking": { label: "Stack Ranking", icon: ListOrdered },
  marketplace: { label: "Marketplace", icon: Coins },
  survey: { label: "Survey", icon: ClipboardList },
  "priority-matrix": { label: "Priority Matrix", icon: Grid3x3 },
  staircase: { label: "Staircase", icon: TrendingUp },
};

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  testId,
}: {
  icon: any;
  label: string;
  value: number | string;
  hint?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VelocitySparkline({ timestamps }: { timestamps: number[] }) {
  // Bucket the rolling 10-minute window into 20 × 30s slots.
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

export interface PulsePanelProps {
  spaceId: string;
  /**
   * Bumped by the parent whenever an event handled by the existing facilitator
   * WS subscription arrives. The Pulse panel uses it to decide when to
   * invalidate its snapshot query — that way every relevant live update
   * (note_created, vote_recorded, ranking_submitted, etc.) drives the panel
   * without spinning up a second WebSocket connection.
   */
  liveTick: number;
}

export default function PulsePanel({ spaceId, liveTick }: PulsePanelProps) {
  const queryKey = [`/api/spaces/${spaceId}/pulse`];
  const { data, isLoading, error, refetch } = useQuery<PulseSnapshot>({
    queryKey,
    enabled: !!spaceId,
  });

  // Local rolling buffer so the sparkline ticks instantly on each note_created
  // without waiting for the snapshot refetch round-trip. We seed it from the
  // server snapshot and append `Date.now()` whenever the parent's liveTick
  // bumps for an idea event.
  const [recentTs, setRecentTs] = useState<number[]>([]);
  const lastIdeaTickRef = useRef<{ tick: number; spaceId: string } | null>(null);

  useEffect(() => {
    if (data?.recentNoteTimestamps) {
      setRecentTs(data.recentNoteTimestamps);
    }
  }, [data?.recentNoteTimestamps]);

  // Coalesce + debounce snapshot invalidations so a burst of WS events doesn't
  // hammer the server. Up to one refetch per second.
  const lastInvalidatedAt = useRef<number>(0);
  const invalidateTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!spaceId) return;
    if (liveTick === 0) return;
    const since = Date.now() - lastInvalidatedAt.current;
    const fire = () => {
      lastInvalidatedAt.current = Date.now();
      queryClient.invalidateQueries({ queryKey });
    };
    if (since >= 1000) {
      fire();
    } else if (invalidateTimer.current == null) {
      invalidateTimer.current = window.setTimeout(() => {
        invalidateTimer.current = null;
        fire();
      }, 1000 - since);
    }
    return () => {
      if (invalidateTimer.current != null) {
        clearTimeout(invalidateTimer.current);
        invalidateTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick, spaceId]);

  // Trim the rolling buffer to the last 10 minutes whenever it changes or when
  // a new tick fires. This keeps the sparkline accurate without polling.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRecentTs(prev => {
        const cutoff = Date.now() - 10 * 60 * 1000;
        const next = prev.filter(t => t >= cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
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

  if (error) {
    return (
      <QueryErrorState
        title="Couldn't load Pulse"
        description="The live analytics snapshot could not be loaded."
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) return null;

  const { participants, counts, perModuleParticipation, topContributors } = data;
  const moduleEntries = Object.entries(perModuleParticipation);

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
          value={counts.ideas}
          testId="tile-ideas"
        />
        <Tile
          icon={Vote}
          label="Pairwise Votes"
          value={counts.votes}
          testId="tile-votes"
        />
        <Tile
          icon={Coins}
          label="Marketplace Allocations"
          value={counts.marketplaceAllocations}
          testId="tile-marketplace"
        />
        <Tile
          icon={ListOrdered}
          label="Rankings"
          value={counts.rankings}
          testId="tile-rankings"
        />
        <Tile
          icon={ClipboardList}
          label="Survey Responses"
          value={counts.surveyResponses}
          testId="tile-surveys"
        />
        <Tile
          icon={Grid3x3}
          label="Matrix Placements"
          value={counts.matrixPlacements}
          testId="tile-matrix"
        />
        <Tile
          icon={TrendingUp}
          label="Staircase Placements"
          value={counts.staircasePlacements}
          testId="tile-staircase"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card data-testid="card-velocity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Idea velocity
            </CardTitle>
            <CardDescription>
              New ideas submitted in the last 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3">
              <div
                className="text-3xl font-semibold"
                data-testid="text-velocity-count"
              >
                {recentTs.length}
              </div>
              <div className="flex-1">
                <VelocitySparkline timestamps={recentTs} />
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
              moduleEntries.map(([key, p]) => {
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
                        {p.engaged}/{p.total} ({p.percent}%)
                      </span>
                    </div>
                    <Progress value={p.percent} className="h-2" />
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
          <CardDescription>
            Ranked by ideas authored plus pairwise votes cast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topContributors.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-leaderboard-empty"
            >
              No contributions yet — once participants submit ideas or vote,
              they'll appear here.
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
                    <span className="text-sm font-mono text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <span className="truncate text-sm font-medium" data-testid={`text-contributor-name-${idx}`}>
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
