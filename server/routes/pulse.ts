import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import type { User } from "@shared/schema";
import { logger } from "../utils/logger";

// Resolve a workspace identifier (UUID or 8-digit workspace code) to a
// canonical workspace UUID. Returns null if not found.
async function resolveWorkspaceId(identifier: string): Promise<string | null> {
  const isWorkspaceCode = /^\d{8}$/.test(identifier) || /^\d{4}-\d{4}$/.test(identifier);
  if (isWorkspaceCode) {
    const space = await storage.getSpaceByCode(identifier);
    return space?.id || null;
  }
  return identifier;
}

// Live "Pulse" facilitator analytics dashboard
// ============================================
// Returns a single batched snapshot of every metric the Pulse tab shows.
// Read-only and facilitator-scoped (global_admin OR matching company_admin
// OR an explicit space_facilitator) so participants can never poll it.
export function registerPulseRoute(app: Express): void {
  app.get("/api/spaces/:spaceId/pulse", requireAuth, async (req, res) => {
    try {
      const spaceId = await resolveWorkspaceId(req.params.spaceId);
      if (!spaceId) return res.status(404).json({ error: "Workspace not found" });
      const space = await storage.getSpace(spaceId);
      if (!space) return res.status(404).json({ error: "Workspace not found" });

      const reqUser = req.user as User;
      if (reqUser.role !== 'global_admin') {
        const isCompanyAdminForOrg = reqUser.role === 'company_admin' && reqUser.organizationId === space.organizationId;
        if (!isCompanyAdminForOrg) {
          const facilitators = await storage.getSpaceFacilitatorsBySpace(spaceId);
          if (!facilitators.some(f => f.userId === reqUser.id)) {
            return res.status(403).json({ error: "Not authorized for this workspace" });
          }
        }
      }

      // Fetch lightweight metadata first so we can pass matrix/staircase IDs
      // into the aggregate query.
      const [participants, modules, priorityMatrix, staircaseModule] = await Promise.all([
        storage.getParticipantsBySpace(spaceId),
        storage.getWorkspaceModules(spaceId),
        storage.getPriorityMatrix(spaceId),
        storage.getStaircaseModule(spaceId),
      ]);

      // Aggregated counts/distincts replace the previous full row fetches.
      // Each underlying query is a COUNT / COUNT(DISTINCT) / GROUP BY that
      // scales with cohort size rather than total activity, keeping payloads
      // and DB work bounded as cohorts grow past the 100-participant scope.
      const pulseStart = Date.now();
      const aggregates = await storage.getPulseAggregates(spaceId, {
        matrixId: priorityMatrix?.id ?? null,
        staircaseId: staircaseModule?.id ?? null,
        recentSinceMs: 10 * 60 * 1000,
      });
      const pulseDurationMs = Date.now() - pulseStart;

      const joined = participants.length;
      const online = participants.filter(p => p.isOnline).length;

      const engagedByModule: Record<string, string[]> = {
        ideation: aggregates.distinctNoteParticipants,
        'pairwise-voting': aggregates.distinctVoteParticipants,
        'stack-ranking': aggregates.distinctRankingParticipants,
        marketplace: aggregates.distinctMarketplaceParticipants,
        survey: aggregates.distinctSurveyParticipants,
        'priority-matrix': aggregates.distinctMatrixParticipants,
        staircase: aggregates.distinctStaircaseParticipants,
      };
      const enabledModules = modules.filter(m => m.enabled).map(m => m.moduleType);

      // Contributor stats (notes + votes per participant) come from GROUP BY
      // aggregates so the client can render the leaderboard without us shipping
      // raw rows.
      const contributorStats: Record<string, { notes: number; votes: number }> = {};
      for (const r of aggregates.noteCountsByParticipant) {
        const cur = contributorStats[r.participantId] || { notes: 0, votes: 0 };
        cur.notes = r.count;
        contributorStats[r.participantId] = cur;
      }
      for (const r of aggregates.voteCountsByParticipant) {
        const cur = contributorStats[r.participantId] || { notes: 0, votes: 0 };
        cur.votes = r.count;
        contributorStats[r.participantId] = cur;
      }
      const participantNames: Record<string, string> = {};
      for (const p of participants) participantNames[p.id] = p.displayName;

      // Lightweight benchmark logging so growth past the documented scope is
      // observable. Useful when validating with 500-participant test cohorts.
      if (joined >= 200 || pulseDurationMs > 250) {
        logger.info("pulse slow/large", { spaceId, participants: joined, aggregateMs: pulseDurationMs });
      }

      // Per-minute activity heatmap across the full session, sourced from the
      // append-only `pulse_activity_events` log. We read from the event log
      // (rather than the current-state tables) so that upsert-style modules
      // — rankings, marketplace, survey, matrix, staircase — preserve every
      // historical engagement instead of collapsing repeated activity into a
      // single createdAt/updatedAt timestamp.
      const activitySeries = await storage.getPulseActivityBuckets(spaceId);

      res.json({
        participants: { joined, online },
        totals: {
          ideas: aggregates.noteCount,
          votes: aggregates.voteCount,
        },
        engagedByModule,
        enabledModules,
        contributorStats,
        participantNames,
        recentNoteTimestamps: aggregates.recentNoteTimestamps,
        activitySeries,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("pulse snapshot failed", { error });
      res.status(500).json({ error: "Failed to load pulse snapshot" });
    }
  });
}
